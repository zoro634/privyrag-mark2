files = get_all_files("data")

with open("file_list.txt", "w", encoding="utf-8") as f:
    for path in files:
        f.write(path + "\n")