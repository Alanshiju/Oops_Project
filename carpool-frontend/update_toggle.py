import glob

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Chat Toggle Button
    old_toggle = r'className="bg-blue-600 hover:bg-blue-700 text-white w-14 h-14 rounded-full shadow-\[0_0_15px_rgba\(37,99,235,0\.5\)\] flex items-center justify-center text-2xl relative"'
    new_toggle = 'className="bg-indigo-600 hover:bg-indigo-700 text-white w-14 h-14 rounded-full shadow-[0_0_15px_rgba(79,70,229,0.5)] flex items-center justify-center text-2xl relative transform transition-transform active:scale-95"'
    
    import re
    content = re.sub(old_toggle, new_toggle, content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

for file in glob.glob('src/pages/*Dashboard.jsx'):
    process_file(file)

