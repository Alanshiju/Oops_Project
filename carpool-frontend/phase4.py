import re

def process_student():
    with open('src/pages/StudentDashboard.jsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Layout wrapper
    content = content.replace(
        'className="flex flex-col items-center mt-10 w-full max-w-3xl mx-auto"',
        'className="flex flex-col-reverse lg:flex-row gap-6 max-w-7xl mx-auto p-4 w-full"'
    )

    # Map container
    content = content.replace(
        'className="w-full h-full rounded-2xl shadow-md border-0"',
        'className="w-full h-[45vh] lg:h-[650px] rounded-[2rem] overflow-hidden shadow-2xl shadow-indigo-900/20 z-0"'
    )
    content = content.replace(
        'className="relative w-full h-[350px]"',
        'className="relative w-full"'
    )

    # Map Tiles
    content = content.replace(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
    )
    content = content.replace(
        "&copy; OpenStreetMap &copy; CARTO",
        "Tiles &copy; Esri"
    )

    # Import framer-motion
    if "framer-motion" not in content:
        content = content.replace(
            'import { useState, useEffect, useRef } from "react";',
            'import { useState, useEffect, useRef } from "react";\nimport { motion } from "framer-motion";'
        )

    # Primary Action Buttons
    content = re.sub(
        r'className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2\.5 px-8 rounded-full shadow-lg transform transition-transform active:scale-95 hover:shadow-xl"',
        r'className="bg-gradient-to-br from-indigo-500 to-indigo-800 text-white font-black py-3.5 px-6 rounded-full hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-indigo-900/25"',
        content
    )

    # Wrap cards with motion.div
    # Search Results Card (rides.map)
    content = content.replace(
        '<div key={ride.rideId} className="p-6 hover:shadow-lg transition-shadow flex justify-between items-center bg-white rounded-2xl shadow-md border border-slate-100">',
        '<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} key={ride.rideId} className="p-5 flex justify-between items-center bg-white/80 backdrop-blur-xl border border-white/40 rounded-[2rem] shadow-xl shadow-indigo-900/10 mb-4">'
    )

    # Active Booking Card
    content = content.replace(
        '<div className="bg-white p-5 rounded-xl shadow-lg border-l-8 border-blue-600 flex justify-between items-center">',
        '<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="bg-white/80 backdrop-blur-xl border-l-8 border-indigo-600 rounded-[2rem] shadow-xl shadow-indigo-900/10 p-5 flex justify-between items-center border border-white/40">'
    )
    content = content.replace(
        '</button>\n              </div>\n\n              {/* Live Tracking Map */}',
        '</button>\n              </motion.div>\n\n              {/* Live Tracking Map */}'
    )

    with open('src/pages/StudentDashboard.jsx', 'w', encoding='utf-8') as f:
        f.write(content)

def process_driver():
    with open('src/pages/DriverDashboard.jsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Layout wrapper
    content = content.replace(
        'className="flex flex-col lg:flex-row h-[90vh] p-4 gap-6 bg-slate-50"',
        'className="flex flex-col-reverse lg:flex-row gap-6 max-w-7xl mx-auto p-4"'
    )

    # Map container
    content = content.replace(
        'className="w-full h-full rounded-2xl shadow-md border-0"',
        'className="w-full h-[45vh] lg:h-[650px] rounded-[2rem] overflow-hidden shadow-2xl shadow-indigo-900/20 z-0"'
    )

    # Map Tiles
    content = content.replace(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
    )
    content = content.replace(
        "&copy; OpenStreetMap &copy; CARTO",
        "Tiles &copy; Esri"
    )

    # Import framer-motion
    if "framer-motion" not in content:
        content = content.replace(
            'import { useState, useEffect, useRef } from "react";',
            'import { useState, useEffect, useRef } from "react";\nimport { motion } from "framer-motion";'
        )

    # Sidebar Steps
    content = content.replace(
        '<div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">',
        '<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="bg-white/80 backdrop-blur-xl border border-white/40 rounded-[2rem] shadow-xl shadow-indigo-900/10 p-5">'
    )
    content = content.replace(
        'className="text-lg font-bold text-slate-800 mb-3 border-b pb-2"',
        'className="text-lg font-bold text-slate-800 mb-4"'
    )
    content = content.replace(
        '</div>\n\n          {/* Controls */}',
        '</motion.div>\n\n          {/* Controls */}'
    )
    content = content.replace(
        '</div>\n\n        {/* Right Sidebar */}',
        '</motion.div>\n\n        {/* Right Sidebar */}'
    )
    content = content.replace(
        '</div>\n      </div>\n\n      {/* Right Sidebar */}',
        '</motion.div>\n      </div>\n\n      {/* Right Sidebar */}'
    ) # adjust for possible closing tags

    # Primary Action Buttons
    content = re.sub(
        r'className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 rounded-xl shadow-md transform transition-transform active:scale-95 hover:shadow-lg"',
        r'className="w-full bg-gradient-to-br from-indigo-500 to-indigo-800 text-white font-black py-3.5 px-6 rounded-full hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-indigo-900/25"',
        content
    )
    content = re.sub(
        r'className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 px-4 rounded-xl shadow-md transform transition-transform active:scale-95 hover:shadow-lg"',
        r'className="w-full bg-gradient-to-br from-indigo-500 to-indigo-800 text-white font-black py-3.5 px-6 rounded-full hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-indigo-900/25"',
        content
    )
    # complete ride button
    content = re.sub(
        r'className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 px-4 rounded-xl shadow-md transform transition-transform active:scale-95 hover:shadow-lg"',
        r'className="w-full bg-gradient-to-br from-emerald-500 to-emerald-800 text-white font-black py-3.5 px-6 rounded-full hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-emerald-900/25"',
        content
    )

    # Active Passengers Card styling
    content = content.replace(
        '<div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mt-4">',
        '<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="bg-white/80 backdrop-blur-xl border border-white/40 rounded-[2rem] shadow-xl shadow-indigo-900/10 p-5 mt-4">'
    )
    content = content.replace(
        '</ul>\n        </div>\n      </div>',
        '</ul>\n        </motion.div>\n      </div>'
    )
    
    with open('src/pages/DriverDashboard.jsx', 'w', encoding='utf-8') as f:
        f.write(content)

process_student()
process_driver()

