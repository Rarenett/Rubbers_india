Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "c:\Archana\glenda_vite\scripts"
WshShell.Run "pythonw desktop_capture_agent.py --server http://127.0.0.1:8000", 0, False
