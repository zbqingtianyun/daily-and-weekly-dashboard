"""通过 MySQL 账号执行单条 SQL，写操作需要显式授权。"""

import argparse
import json
import re
from typing import Any, Dict

from db import get_connection


READ_ONLY_STARTS = ("SELECT", "SHOW", "DESCRIBE", "DESC", "EXPLAIN")
WRITE_KEYWORDS = re.compile(
    r"\b(INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP|TRUNCATE|"
    r"RENAME|GRANT|REVOKE|CALL|LOAD|HANDLER|LOCK|UNLOCK|SET|USE|"
    r"INTO\s+OUTFILE|INTO\s+DUMPFILE)\b",
    re.IGNORECASE,
)


def validate_sql(sql: str, allow_write: bool = False) -> str:
    """拒绝多语句；未显式授权时只允许只读 SQL。"""
    cleaned = sql.strip().rstrip(";").strip()
    if not cleaned:
        raise ValueError("SQL 不能为空")

    if ";" in cleaned:
        raise ValueError("一次只允许执行一条 SQL")

    first_word = re.match(r"^\s*([A-Za-z]+)", cleaned)
    if not first_word:
        raise ValueError("无法识别 SQL 类型")

    command = first_word.group(1).upper()
    is_read_only = (
        command in READ_ONLY_STARTS
        or (command == "WITH" and not WRITE_KEYWORDS.search(cleaned))
    )
    if not is_read_only and not allow_write:
        raise ValueError("检测到写入或管理操作；如确认执行，请添加 --allow-write")

    return cleaned


def run_query(
    sql: str,
    max_rows: int = 500,
    allow_write: bool = False,
) -> Dict[str, Any]:
    """执行单条 SQL；查询限制返回行数，写操作返回影响行数。"""
    cleaned = validate_sql(sql, allow_write=allow_write)
    row_limit = max(1, min(max_rows, 2000))

    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SET SESSION MAX_EXECUTION_TIME = 30000")
            affected_rows = cursor.execute(cleaned)

            if cursor.description is not None:
                rows = cursor.fetchmany(row_limit + 1)
                truncated = len(rows) > row_limit
                return {
                    "operation": "query",
                    "row_count": min(len(rows), row_limit),
                    "truncated": truncated,
                    "max_rows": row_limit,
                    "rows": rows[:row_limit],
                }

        connection.commit()

    return {
        "operation": "write",
        "affected_rows": affected_rows,
        "committed": True,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="执行单条 MySQL SQL")
    parser.add_argument("--sql", required=True, help="要执行的单条 SQL")
    parser.add_argument(
        "--max-rows",
        type=int,
        default=500,
        help="最大返回行数，范围 1 到 2000，默认 500",
    )
    parser.add_argument(
        "--allow-write",
        action="store_true",
        help="明确允许执行写入、DDL 或管理类 SQL，并提交事务",
    )
    args = parser.parse_args()

    try:
        result = run_query(
            args.sql,
            max_rows=args.max_rows,
            allow_write=args.allow_write,
        )
    except Exception as error:
        result = {
            "ok": False,
            "error_type": type(error).__name__,
            "error": str(error),
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))
        raise SystemExit(1)

    result["ok"] = True
    print(json.dumps(result, ensure_ascii=False, default=str, indent=2))


if __name__ == "__main__":
    main()
