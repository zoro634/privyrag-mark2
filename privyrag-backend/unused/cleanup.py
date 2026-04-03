import os
import shutil

BASE_DIR = r"C:\Users\Sohan Jala\Projects\localGPT"

# Folders to delete
folders_to_delete = [
    "node_modules",
    "public",
    "src",
    "Documentation",
]

# Files to delete
files_to_delete = [
    "package.json",
    "package-lock.json",
    "next.config.ts",
    "postcss.config.mjs",
    "tailwind.config.js",
    "tsconfig.json",
    "eslint.config.mjs",
    "docker-compose.yml",
    "docker-compose.local-ollama.yml",
    "docker.env",
    "Dockerfile.backend",
    "Dockerfile.frontend",
    "Dockerfile.rag-api",
    "DOCKER_README.md",
    "DOCKER_TROUBLESHOOTING.md",
    "start-docker.sh",
    "test_docker_build.sh",
    "demo_batch_indexing.py",
    "create_index_script.py",
    "simple_create_index.sh",
    "setup_rag_system.sh",
    "test_markdown_streaming.js",
    "structure.txt",
]

# Delete folders
for folder in folders_to_delete:
    path = os.path.join(BASE_DIR, folder)
    if os.path.exists(path):
        print(f"Deleting folder: {path}")
        shutil.rmtree(path, ignore_errors=True)

# Delete files
for file in files_to_delete:
    path = os.path.join(BASE_DIR, file)
    if os.path.exists(path):
        print(f"Deleting file: {path}")
        os.remove(path)

# Remove __pycache__ everywhere
for root, dirs, files in os.walk(BASE_DIR):
    for d in dirs:
        if d == "__pycache__":
            full_path = os.path.join(root, d)
            print(f"Deleting cache: {full_path}")
            shutil.rmtree(full_path, ignore_errors=True)

print("\n✅ Cleanup complete!")