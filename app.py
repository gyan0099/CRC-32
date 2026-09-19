import zlib
import json
import sqlite3
from flask import Flask, request, jsonify, send_from_directory
import os

app = Flask(__name__, static_folder='.', static_url_path='')

# Initialize database
def init_db():
    conn = sqlite3.connect('transmissions.db')
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alert_id TEXT,
            severity TEXT,
            status TEXT,
            error_simulated BOOLEAN
        )
    ''')
    conn.commit()
    conn.close()

init_db()

@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/api/calculate_crc', methods=['POST'])
def calculate_crc():
    data = request.json
    # Exact reproduction of JS JSON.stringify format from frontend
    json_str = json.dumps(data)
    # Actually wait, JS JSON.stringify adds spaces differently than Python by default. 
    # Python json.dumps output for JS: JS uses no spaces inside the object if we don't pass spaces?
    # Actually `JSON.stringify(dataObj)` in JS produces `{"id":"...","severity":"..."}`. 
    # Python `json.dumps` produces `{"id": "...", "severity": "..."}` with spaces.
    # To match JS exactly:
    json_str = json.dumps(data, separators=(',', ':'))
    bytes_data = json_str.encode('utf-8')
    
    # Calculate CRC32 using Python's zlib
    crc_value = zlib.crc32(bytes_data) & 0xFFFFFFFF
    
    return jsonify({
        'crc_hex': f"0x{crc_value:08X}",
        'crc_bin': format(crc_value, '032b'),
        'crc_int': crc_value
    })

@app.route('/api/log_transmission', methods=['POST'])
def log_transmission():
    data = request.json
    conn = sqlite3.connect('transmissions.db')
    c = conn.cursor()
    c.execute('INSERT INTO history (alert_id, severity, status, error_simulated) VALUES (?, ?, ?, ?)',
              (data.get('alert_id'), data.get('severity'), data.get('status'), data.get('error_simulated')))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

@app.route('/api/history', methods=['GET'])
def get_history():
    conn = sqlite3.connect('transmissions.db')
    c = conn.cursor()
    c.execute('SELECT alert_id, severity, status, error_simulated FROM history ORDER BY id DESC LIMIT 10')
    rows = c.fetchall()
    conn.close()
    
    history = []
    for row in rows:
        history.append({
            'alert_id': row[0],
            'severity': row[1],
            'status': row[2],
            'error_simulated': row[3]
        })
    return jsonify(history)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
