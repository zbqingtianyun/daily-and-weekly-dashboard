"""离线验证数据快照与指标契约。"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from metric_catalog import FIELDS  # noqa: E402

DATA = ROOT / "data"


def load(name):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def main():
    expected = {item[0] for item in FIELDS}
    catalog = load("metric-catalog.json")
    if {item["key"] for item in catalog} != expected:
        raise SystemExit("指标目录与源表 59 个字段不一致")
    for filename in ("daily.json", "weekly.json"):
        payload = load(filename)
        if not payload["rows"]:
            raise SystemExit(f"{filename} 数据结构无效")
        periods = [row["period"] for row in payload["rows"]]
        if periods != sorted(set(periods)):
            raise SystemExit(f"{filename} 周期重复或无序")
        for row in payload["rows"]:
            if set(row) != expected | {"period"}:
                raise SystemExit(f"{filename} {row.get('period')} 字段集合不一致")
    metadata = load("data-metadata.json")
    if not metadata["validation"]["passed"]:
        raise SystemExit("数据质量状态未通过")
    print("数据契约验证通过：59 个指标，日报与周报快照结构完整。")


if __name__ == "__main__":
    main()
