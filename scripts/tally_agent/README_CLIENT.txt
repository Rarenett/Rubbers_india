===============================================================
                GLENDA ERP - TALLY SYNC AGENT
===============================================================

HOW TO USE THIS:
---------------------------------------------------------------
1. Open Tally Prime on this computer.
2. Make sure your Company is loaded at the "Gateway of Tally".
3. Double-click "Start_Tally_Agent.bat".
4. The window will say:
   [OK] Connected to Tally Prime!
   [OK] Successfully linked with Glenda ERP Cloud!
   STATUS: LISTENING FOR SYNC REQUESTS...
5. Minimize the window. You do NOT need to look at it while working.

Whenever you create, edit, or push Sales Orders, Invoices, or 
Returns in Glenda ERP, this agent will automatically detect them 
and post them directly into Tally Prime!

CONFIGURATION:
---------------------------------------------------------------
If you need to change the website domain or secret key, right-click 
"Start_Tally_Agent.bat" and choose "Edit" (Notepad):
- ERP_URL       : Your website address (e.g. https://yourdomain.com)
- AGENT_KEY     : Your unique secret key
- TALLY_URL     : http://localhost:9000
===============================================================
