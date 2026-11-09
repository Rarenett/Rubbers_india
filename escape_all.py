import glob
import io

files = glob.glob('frontend/src/jsx/components/Sales/*.jsx')
for file_path in files:
    with io.open(file_path, 'r', encoding='utf-8') as f:
        text = f.read()
    
    if 'â‚¹' in text or '₹' in text:
        new_text = text.replace('â‚¹', '\\u20B9').replace('₹', '\\u20B9')
        with io.open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_text)
        print("Updated " + file_path)
