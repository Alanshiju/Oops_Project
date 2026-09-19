import re

def process_nav():
    with open('src/components/Navbar.jsx', 'r', encoding='utf-8') as f:
        content = f.read()

    switcher = '''
            {location.pathname.includes('/driver') ? (
              <Link
                to="/student"
                onClick={toggleMenu}
                className="mt-2 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30 text-center font-bold px-3 py-2 rounded-md text-base transition-colors border border-emerald-500/30"
              >
                🎒 Switch to Student Mode
              </Link>
            ) : (
              <Link
                to="/driver"
                onClick={toggleMenu}
                className="mt-2 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30 text-center font-bold px-3 py-2 rounded-md text-base transition-colors border border-emerald-500/30"
              >
                🚗 Switch to Driver Mode
              </Link>
            )}
'''
    
    content = content.replace(
        '<Link\n              to="/profile"',
        switcher + '            <Link\n              to="/profile"'
    )
    
    content = content.replace('>\n              Dashboard\n            </Link>', '>\n              My Account\n            </Link>')

    # Wait, the string to match might be formatted differently due to prettier, let's just do a regex replace
    content = re.sub(r'<Link\s+to="/profile"', switcher + r'            <Link\n              to="/profile"', content)
    content = re.sub(r'>\s*Dashboard\s*</Link>', '>\n              My Account\n            </Link>', content)

    with open('src/components/Navbar.jsx', 'w', encoding='utf-8') as f:
        f.write(content)

process_nav()

