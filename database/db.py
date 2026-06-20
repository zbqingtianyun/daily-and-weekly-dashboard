"""MySQL 数据库连接配置。"""

import os
from pathlib import Path

import pymysql


def load_local_env() -> None:
    """加载项目根目录的简单 KEY=VALUE 配置，不覆盖已有环境变量。"""
    env_path = Path(__file__).resolve().with_name(".env")
    if not env_path.exists():
        return

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if (
            len(value) >= 2
            and value[0] == value[-1]
            and value[0] in {"'", '"'}
        ):
            value = value[1:-1]

        if key:
            os.environ.setdefault(key, value)


load_local_env()


def get_connection():
    """使用 .env 中的只读账号创建数据库连接。"""
    required_variables = (
        "MYSQL_HOST",
        "MYSQL_DATABASE",
        "MYSQL_USER",
        "MYSQL_PASSWORD",
    )
    missing = [name for name in required_variables if not os.getenv(name)]
    if missing:
        raise RuntimeError(
            "缺少数据库环境变量："
            + ", ".join(missing)
            + "。请在 .env 中填写，密码不要发送到聊天或提交到 Git。"
        )

    return pymysql.connect(
        host=os.environ["MYSQL_HOST"],
        port=int(os.getenv("MYSQL_PORT", "3306")),
        database=os.environ["MYSQL_DATABASE"],
        user=os.environ["MYSQL_USER"],
        password=os.environ["MYSQL_PASSWORD"],
        charset=os.getenv("MYSQL_CHARSET", "utf8mb4"),
        cursorclass=pymysql.cursors.DictCursor,
        connect_timeout=10,
        read_timeout=60,
        write_timeout=10,
        autocommit=True,
    )
