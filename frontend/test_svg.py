import requests

url = 'http://localhost:3001/vite.svg'

try:
    response = requests.get(url)
    print(f'Status Code: {response.status_code}')
    print(f'Content-Type: {response.headers.get("Content-Type")}')
    print(f'Content length: {len(response.text)}')
    if response.status_code == 200:
        print('Success! SVG file is accessible.')
    else:
        print(f'Response: {response.text[:200]}')
except Exception as e:
    print(f'Error: {e}')
