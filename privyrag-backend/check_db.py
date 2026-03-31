import lancedb

db = lancedb.connect("./rag_system/index_store/lancedb")

print("Tables:", db.table_names())

table = db.open_table("default_text_table")

print("Rows:", len(table))
print(table.head(2))