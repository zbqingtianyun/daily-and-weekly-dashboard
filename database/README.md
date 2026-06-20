# 数据库管理工具

本项目通过本地 Python 脚本连接 MySQL 数据库 `edu_company`。
数据库密码只保存在本机 `.env` 文件中。

## 1. 数据库账号

当前可以使用 `.env` 中配置的 MySQL 账号，包括 `root`。使用 `root`
意味着脚本具备修改数据、修改结构和管理数据库的能力，请在执行写操作前
确认数据库和 SQL 均正确。

## 2. 填写本地配置

打开 `.env`，只在本机填写：

```dotenv
MYSQL_PASSWORD=你的数据库账号密码
```

不要把密码发送到聊天中，也不要提交 `.env`。

## 3. 安装依赖

```powershell
python -m pip install --user -r database/requirements.txt
```

## 4. 验证连接

```powershell
python database/query_db.py --sql "SELECT VERSION() AS version"
python database/query_db.py --sql "SHOW TABLES"
```

## 5. 查询示例

```powershell
python database/query_db.py --sql "SELECT * FROM your_table LIMIT 5"
```

查询入口一次只接受一条 SQL，默认最多返回 500 行，单次最多 2000 行，
并设置了 30 秒数据库执行超时。

## 6. 写入和数据库管理

默认模式仍会拦截写入、DDL 和管理操作。确认执行时必须显式添加
`--allow-write`，执行成功后会提交事务：

```powershell
python database/query_db.py --sql "INSERT INTO your_table (name) VALUES ('示例')" --allow-write
python database/query_db.py --sql "UPDATE your_table SET name = '新名称' WHERE id = 1" --allow-write
python database/query_db.py --sql "CREATE TABLE test_table (id BIGINT PRIMARY KEY)" --allow-write
```

删除、清空、修改表结构和权限管理同样可以执行，但不可逆操作应先备份，
并尽量带精确的 `WHERE` 条件。脚本始终拒绝一次执行多条 SQL。
