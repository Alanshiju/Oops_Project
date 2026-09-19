const fs = require('fs');
let content = fs.readFileSync('src/pages/DriverDashboard.jsx', 'utf8');

content = content.replace(/alert\(/g, 'toast(');
content = content.replace(/toast\(\s*"✅ (.*?)"\s*\)/g, 'toast.success("$1")');
content = content.replace(/toast\(\s*"❌ (.*?)"\s*\)/g, 'toast.error("$1")');
content = content.replace(/toast\(\s*"🚨 (.*?)"\s*\)/g, 'toast.error("$1")');
content = content.replace(/toast\(\s*"🔔 (.*?)"\s*\)/g, 'toast.success("$1")');
content = content.replace(/toast\(\s*"⭐ (.*?)"\s*\)/g, 'toast.success("$1")');

content = content.replace(/toast\(\s*"✅ "\s*\+\s*(.*?)\)/g, 'toast.success($1)');
content = content.replace(/toast\(\s*"❌ "\s*\+\s*(.*?)\)/g, 'toast.error($1)');
content = content.replace(/toast\(\s*"⭐ "\s*\+\s*(.*?)\)/g, 'toast.success($1)');
content = content.replace(/toast\(\s*"🔔 "\s*\+\s*(.*?)\)/g, 'toast.success($1)');
content = content.replace(/toast\(\s*"🚨 "\s*\+\s*(.*?)\)/g, 'toast.error($1)');

if(!content.includes('import toast')) {
    content = content.replace('import { useState, useEffect, useRef } from "react";', 'import { useState, useEffect, useRef } from "react";\nimport toast from "react-hot-toast";');
}

fs.writeFileSync('src/pages/DriverDashboard.jsx', content);
