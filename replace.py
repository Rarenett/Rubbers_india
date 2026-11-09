
with open('c:/Users/ADMIN/Documents/GitHub/glenda_vite/frontend/src/jsx/components/Purchase/SupplierOrdersList.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('linear-gradient(160deg, #0f1e45 0%, #1a2f6b 55%, #243580 100%)', 'linear-gradient(160deg, #0d9488 0%, #0f766e 55%, #115e59 100%)')
content = content.replace('T.accent', '\'#0f766e\'')
content = content.replace('#3B5BDB', '#0f766e') 
content = content.replace('#4d6fe8', '#0d9488') 
content = content.replace('#7b93f5', '#14b8a6')
content = content.replace('rgba(59,91,219,', 'rgba(15,118,110,')

with open('c:/Users/ADMIN/Documents/GitHub/glenda_vite/frontend/src/jsx/components/Purchase/SupplierOrdersList.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
