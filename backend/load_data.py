import sqlite3
import pandas as pd
import re
import os

# Path to the dataset
CSV_PATH = "../dataset/Amazon Sales.csv"
DB_PATH = "sales.db"

def extract_csv_from_webloc(filepath):
    # Read as bytes since it appears to be a bplist webarchive
    with open(filepath, 'rb') as f:
        content = f.read()
    
    # Try decoding with errors='ignore'
    text = content.decode('utf-8', errors='ignore')
    
    # Extract content within <pre> tags or just everything after order_id
    if "<pre" in text:
        match = re.search(r'<pre[^>]*>(.*?)</pre>', text, re.IGNORECASE | re.DOTALL)
        if match:
            csv_data = match.group(1)
        else:
            csv_data = text
    else:
        csv_data = text
        
    # We'll just look for the header row and everything after it
    header_start = csv_data.find("order_id,order_date")
    if header_start != -1:
        csv_data = csv_data[header_start:]
    
    # Some basic cleanup for null characters or binary garbage at the end
    csv_data = csv_data.split("</pre>")[0]
    csv_data = csv_data.strip()
    
    return csv_data

def main():
    print("Extracting CSV data...")
    csv_text = extract_csv_from_webloc(CSV_PATH)
    
    # Write cleanly to a temporary CSV
    temp_csv = "temp_sales.csv"
    with open(temp_csv, 'w') as f:
        f.write(csv_text)
        
    print("Loading into Pandas...")
    df = pd.read_csv(temp_csv)
    
    # Convert dates
    df['order_date'] = pd.to_datetime(df['order_date']).dt.strftime('%Y-%m-%d')
    
    print(f"Loaded {len(df)} rows. Creating SQLite database...")
    conn = sqlite3.connect(DB_PATH)
    
    # Clean up column names just in case
    df.columns = [c.strip() for c in df.columns]
    
    df.to_sql('sales', conn, if_exists='replace', index=False)
    conn.close()
    
    os.remove(temp_csv)
    print("Database `sales.db` populated successfully with table `sales`.")

if __name__ == "__main__":
    main()
