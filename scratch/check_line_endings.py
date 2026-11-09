with open('backend/digilocker_app/models.py', 'rb') as f:
    data = f.read()

idx = data.find(b'can_upload')
print(repr(data[idx-20:idx+120]))

