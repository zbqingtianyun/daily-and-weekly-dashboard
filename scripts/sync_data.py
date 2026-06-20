"""只读同步日报、周报，生成可公开部署的静态数据快照。"""

import json
import sys
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "database"))
sys.path.insert(0, str(ROOT / "scripts"))

from db import get_connection  # noqa: E402
from metric_catalog import FIELDS, build_catalog  # noqa: E402

OUTPUT = ROOT / "data"
EXPECTED_FIELDS = [item[0] for item in FIELDS]


def normalize(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def read_table(cursor, table, period_field):
    columns = ", ".join([f"`{period_field}`"] + [f"`{field}`" for field in EXPECTED_FIELDS])
    cursor.execute(f"SELECT {columns} FROM `{table}` ORDER BY `{period_field}` ASC")
    rows = []
    for raw in cursor.fetchall():
        row = {"period": normalize(raw[period_field])}
        row.update({field: normalize(raw[field]) for field in EXPECTED_FIELDS})
        rows.append(row)
    return rows


def validate(rows, grain):
    warnings = []
    periods = [row["period"] for row in rows]
    if len(periods) != len(set(periods)):
        raise ValueError(f"{grain} 数据存在重复周期")
    if periods != sorted(periods):
        raise ValueError(f"{grain} 数据未按时间升序")
    for index, row in enumerate(rows):
        missing = [field for field in EXPECTED_FIELDS if field not in row]
        if missing:
            raise ValueError(f"{grain} 第 {index + 1} 行缺少字段：{missing}")
        for field, _, _, fmt, _, maturity, _ in FIELDS:
            value = row[field]
            if value is None:
                if not (field == "点击支付人数_会员"):
                    warnings.append(f"{grain} {row['period']}：{field} 为空")
                continue
            number = float(value)
            if number < 0:
                raise ValueError(f"{grain} {row['period']}：{field} 出现负值")
            if fmt == "percent" and number > 1:
                warnings.append(f"{grain} {row['period']}：{field} 超过 100%")
            if maturity and number == 0:
                latest = datetime.fromisoformat(periods[-1])
                current = datetime.fromisoformat(row["period"])
                if (latest - current).days < maturity:
                    row[field] = None
                    count_field = field.replace("率", "人数")
                    if count_field in row:
                        row[count_field] = None
    return sorted(set(warnings))


def write_json(name, payload):
    OUTPUT.mkdir(exist_ok=True)
    (OUTPUT / name).write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False),
        encoding="utf-8",
    )


def main():
    with get_connection() as connection:
        with connection.cursor() as cursor:
            daily = read_table(cursor, "日报", "日期")
            weekly = read_table(cursor, "周报", "当周周一")

    warnings = validate(daily, "日报") + validate(weekly, "周报")
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    write_json("daily.json", {"grain": "day", "rows": daily})
    write_json("weekly.json", {"grain": "week", "rows": weekly})
    write_json("metric-catalog.json", build_catalog())
    write_json(
        "data-metadata.json",
        {
            "generatedAt": generated_at,
            "sourceDatabase": "edu_company",
            "sources": {
                "daily": {"table": "日报", "rowCount": len(daily), "minPeriod": daily[0]["period"], "maxPeriod": daily[-1]["period"]},
                "weekly": {"table": "周报", "rowCount": len(weekly), "minPeriod": weekly[0]["period"], "maxPeriod": weekly[-1]["period"]},
            },
            "validation": {"passed": True, "warnings": warnings},
            "weeklySemantics": "周报中的人数、活跃、金额等指标按周内日均值展示。",
        },
    )
    print(f"同步完成：日报 {len(daily)} 行，周报 {len(weekly)} 行，警告 {len(warnings)} 条。")


if __name__ == "__main__":
    main()

