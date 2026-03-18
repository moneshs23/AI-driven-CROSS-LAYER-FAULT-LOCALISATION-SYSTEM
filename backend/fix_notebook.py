import nbformat

with open("backend.ipynb", "r") as f:
    nb = nbformat.read(f, as_version=4)

code_cell = nb.cells[0]
source = code_cell.source

# Replace the interactive choice block
source = source.replace('choice = input("\\nEnter choice (1/2/3): ")', 'choice = "2"  # Automatically selecting Industries for demo')

# Replace exit() which kills Jupyter kernel
source = source.replace('exit()', 'raise FileNotFoundError(f"❌ Error: {active_file} not found. Ensure the CSV is in the directory.")')

# Replace the while True loop with a single demonstration call
old_interactive_block = """print(f"\\n✅ TANFINET AI Agent for {active_sector} is Online.")

while True:
    try:
        print(f"\\n[Entering {active_sector.upper()} Vitals. Type 'quit' to exit]")
        lat_raw = input("1. Latency (ms): ")
        if lat_raw.lower() == 'quit': break
        
        vitals = {
            'lat': float(lat_raw),
            'loss': float(input("2. Packet Loss (%): ")),
            'jitter': float(input("3. Jitter (ms): ")),
            'opt': float(input("4. Optical RX (dBm): ")),
            'crc': int(input("5. CRC Errors: ")),
            'status': int(input("6. Interface Status (1/0): ")),
            'cpu': float(input("7. CPU Usage (%): ")),
            'snmp': int(input("8. SNMP Timeout (1/0): ")),
            'hop': int(input("9. Hop Count (2-6): "))
        }
        generate_report(vitals)
    except ValueError:
        print("❌ Error: Use numerical values.")"""

new_demo_block = """print(f"\\n✅ TANFINET AI Agent for {active_sector} is Online.")

print(f"\\n[Running Demo Diagnostic for {active_sector.upper()}]")
demo_vitals = {
    'lat': 85.0,
    'loss': 2.0,
    'jitter': 10.0,
    'opt': -25.0,
    'crc': 1,
    'status': 1,
    'cpu': 65.0,
    'snmp': 0,
    'hop': 4
}
print(f"Vitals inputted: {demo_vitals}")
generate_report(demo_vitals)"""

source = source.replace(old_interactive_block, new_demo_block)

code_cell.source = source
nb.cells[0] = code_cell

with open("backend.ipynb", "w") as f:
    nbformat.write(nb, f)
