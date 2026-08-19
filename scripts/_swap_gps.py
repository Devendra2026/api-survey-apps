"""Swap Longitude/Latitude order in sample rows so Latitude comes first."""
import re
from pathlib import Path

path = Path(__file__).parent / "generate-survey-data-modern.py"
content = path.read_text(encoding="utf-8")

# Match pairs where Longitude comes before Latitude
pattern = r'(\s*)"Longitude": ([0-9.]+),\n(\s*)"Latitude": ([0-9.]+),'
def swap(m):
    indent = m.group(1)
    lng = m.group(2)
    lat = m.group(4)
    return f'{indent}"Latitude": {lat},\n{indent}"Longitude": {lng},'

content = re.sub(pattern, swap, content)
path.write_text(content, encoding="utf-8")
print("Swapped all Longitude/Latitude pairs")
