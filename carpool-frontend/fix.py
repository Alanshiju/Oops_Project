import glob

for f in glob.glob('src/pages/*Dashboard.jsx'):
    with open(f, 'r', encoding='utf-8') as file:
        content = file.read()
    content = content.replace(r"\'", "'")
    with open(f, 'w', encoding='utf-8') as file:
        file.write(content)

