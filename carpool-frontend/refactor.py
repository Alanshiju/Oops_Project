import re

def process_file(filepath, is_student=False):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Map Tiles
    content = re.sub(
        r'L\.tileLayer\("https://\{s\}\.tile\.openstreetmap\.org/\{z\}/\{x\}/\{y\}\.png",\s*\{',
        r'L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {\n          maxZoom: 19,\n          attribution: \'&copy; OpenStreetMap &copy; CARTO\',',
        content
    )

    # 2. Map Container
    content = content.replace(
        'className="w-full h-full rounded-lg border-2 border-slate-200"',
        'className="w-full h-full rounded-2xl shadow-md border-0"'
    )
    content = content.replace(
        'className="w-full h-full rounded-xl shadow-lg border-4 border-white"',
        'className="w-full h-full rounded-2xl shadow-md border-0"'
    )

    # 3. Chat Widget Overhaul
    old_chat = r'<div className="bg-white w-80 h-96 rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">.*?</div>\s*\)\s*:\s*\('
    
    new_chat = '''<div className="bg-white w-80 h-[28rem] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden mb-4">
                <div
                  className="bg-indigo-600 text-white p-4 font-bold flex justify-between items-center cursor-pointer shadow-sm"
                  onClick={() => setIsChatOpen(false)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">💬</span>
                    <span>Ride Chat</span>
                  </div>
                  <button className="hover:bg-indigo-500 rounded-full w-8 h-8 flex items-center justify-center transition-colors">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-slate-50">
                  {chatMessages.map((msg, i) => {
                    const isSelf = msg.senderName === "Student" || msg.senderName === "Driver" || (profile && msg.senderName === profile.name);
                    return (
                      <div
                        key={i}
                        className={`max-w-[85%] p-3 text-sm shadow-sm ${isSelf ? "bg-indigo-600 text-white self-end rounded-t-2xl rounded-l-2xl rounded-br-none" : "bg-gray-100 text-slate-800 self-start rounded-t-2xl rounded-r-2xl rounded-bl-none"}`}
                      >
                        <div className={`font-bold text-[10px] mb-1 ${isSelf ? 'text-indigo-200' : 'text-slate-500'}`}>
                          {msg.senderName}
                        </div>
                        <div className="leading-relaxed">{msg.text}</div>
                        <div className={`text-[9px] text-right mt-1 ${isSelf ? 'text-indigo-300' : 'text-slate-400'}`}>
                          {msg.timestamp}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={(el) => { if (el) el.scrollIntoView({ behavior: "smooth" }); }}></div>
                </div>
                <form
                  onSubmit={handleSendChatMessage}
                  className="p-3 bg-white border-t border-slate-100 flex gap-2 items-center"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 p-3 bg-slate-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    className="bg-indigo-600 disabled:bg-slate-300 text-white w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 shadow-md"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 ml-1">
                      <path d="M3.478 2.404a.75.75 0 00-.926.941l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.404z" />
                    </svg>
                  </button>
                </form>
              </div>
            ) : ('''
    content = re.sub(old_chat, new_chat, content, flags=re.DOTALL)

    if is_student:
        # Ride Card
        old_card = r'<div\s+key=\{ride\.rideId\}\s+className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden"\s*>.*?</div>\s*\)\s*:\s*\(\s*<button\s*onClick=\{.*?\}\s*className="bg-blue-600.*?Book Seat\s*</button>\s*\)\}\s*</div>\s*</div>\s*</div>'
        
        new_card = '''<div key={ride.rideId} className="p-6 hover:shadow-lg transition-shadow flex justify-between items-center bg-white rounded-2xl shadow-md border border-slate-100">
  <div className="flex items-center gap-5">
    <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${ride.driverName || 'Driver'}&backgroundColor=4f46e5`} alt="Driver Avatar" className="w-16 h-16 rounded-full shadow-sm border-2 border-indigo-50" />
    <div className="flex flex-col">
      <h3 className="text-xl font-extrabold text-slate-800">{ride.driverName || "Driver"}</h3>
      <p className="text-sm font-medium text-slate-500 mt-0.5">{ride.carColor || ""} {ride.vehicleMake || "Unknown"} {ride.vehicleModel || "Vehicle"} &bull; <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">{ride.licensePlate || "N/A"}</span></p>
      <div className="flex items-center gap-2 mt-2">
         <span className="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-md font-bold">{ride.availableSeats} Seats Left</span>
         <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1 rounded-md font-bold">{ride.distanceKm} km</span>
      </div>
    </div>
  </div>
  <div className="flex flex-col items-end gap-3">
    <div className="text-3xl font-black text-slate-800">
      {ride.isFreeRide || ride.costPerSeat === 0 ? "Free" : `₹${ride.costPerSeat}`}
    </div>
    {hasActiveBooking ? (
       <div className="bg-slate-100 text-slate-400 font-bold py-2 px-6 rounded-full text-sm cursor-not-allowed">Booking Active</div>
    ) : (
       <button onClick={() => handleBookSeat(ride.rideId)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-8 rounded-full shadow-lg transform transition-transform active:scale-95 hover:shadow-xl">Book Seat</button>
    )}
  </div>
</div>'''
        content = re.sub(old_card, new_card, content, flags=re.DOTALL)

        # Scan Button
        old_scan = r'<button\s*onClick=\{handleSearchRides\}.*?>.*?Scan My Area for Rides.*?^\s*</button>'
        new_scan = '''<button
            onClick={handleSearchRides}
            disabled={isSearching}
            className={`px-8 py-4 rounded-xl font-extrabold text-white transform transition-transform active:scale-95 flex items-center justify-center gap-3 ${
              isSearching
                ? "bg-indigo-400 cursor-not-allowed shadow-none"
                : "bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg shadow-md"
            }`}
          >
            {isSearching ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Scanning Route Data...
              </>
            ) : "Scan My Area for Rides"}
          </button>'''
        content = re.sub(old_scan, new_scan, content, flags=re.MULTILINE|re.DOTALL)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

process_file('src/pages/StudentDashboard.jsx', True)
process_file('src/pages/DriverDashboard.jsx', False)
print("Done")

