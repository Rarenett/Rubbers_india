with open('WORKLOG.md', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('\x0crontend', 'frontend')
text = text.replace(' ackend', 'backend')
text = text.replace('reads \x0colder.default_otp_email', 'reads `folder.default_otp_email`')

with open('WORKLOG.md', 'w', encoding='utf-8') as f:
    f.write(text)

print('WORKLOG.md formatted cleanly.')

