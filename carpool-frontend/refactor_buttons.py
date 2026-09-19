import re

def process_file():
    with open('src/pages/DriverDashboard.jsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Accept button
    old_accept = r'className="flex-1 bg-green-500 text-white text-xs font-bold py-1 rounded"'
    new_accept = 'className="flex-1 bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-2 rounded-lg transform transition-transform active:scale-95 shadow-sm hover:shadow-md"'
    content = re.sub(old_accept, new_accept, content)

    # Reject button
    old_reject = r'className="flex-1 bg-red-500 text-white text-xs font-bold py-1 rounded"'
    new_reject = 'className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-2 rounded-lg transform transition-transform active:scale-95 shadow-sm hover:shadow-md"'
    content = re.sub(old_reject, new_reject, content)

    # Start Driving button
    old_start = r'className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow"'
    new_start = 'className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 px-4 rounded-xl shadow-md transform transition-transform active:scale-95 hover:shadow-lg"'
    content = re.sub(old_start, new_start, content)

    # Complete Ride button
    old_complete = r'className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded shadow"'
    new_complete = 'className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 px-4 rounded-xl shadow-md transform transition-transform active:scale-95 hover:shadow-lg"'
    content = re.sub(old_complete, new_complete, content)

    # Publish Ride button
    old_publish = r'className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg shadow"'
    new_publish = 'className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 rounded-xl shadow-md transform transition-transform active:scale-95 hover:shadow-lg"'
    content = re.sub(old_publish, new_publish, content)

    with open('src/pages/DriverDashboard.jsx', 'w', encoding='utf-8') as f:
        f.write(content)

process_file()

