"""Fail a build if another Expo plugin removes voice recording permission."""
import sys
import xml.etree.ElementTree as ET

if sys.argv[1] == '--apk':
    assert "name='android.permission.RECORD_AUDIO'" in sys.stdin.read(), 'APK is missing RECORD_AUDIO'
else:
    root = ET.parse(sys.argv[1]).getroot()
    permissions = [p for p in root.findall('uses-permission') if p.get('{http://schemas.android.com/apk/res/android}name') == 'android.permission.RECORD_AUDIO']
    assert permissions, 'Manifest is missing RECORD_AUDIO'
    assert all(p.get('{http://schemas.android.com/tools}node') != 'remove' for p in permissions), 'A plugin removed RECORD_AUDIO'
print('Android recording permission verified')
