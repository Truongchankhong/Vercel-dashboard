import os
import sys
import json
import base64
import socket
import re
import urllib.request
import urllib.error
import http.server
import socketserver
import threading
from pathlib import Path
import webview

# Config
APP_TITLE = "Dashboard Tổng Hợp OVN"
SUPABASE_URL = "https://ixdtdrbytwdmnlqgunzu.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml4ZHRkcmJ5dHdkbW5scWd1bnp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMzkyODYsImV4cCI6MjA2ODgxNTI4Nn0.5FLdLDf0d1yA70UBmAbJYW95kVWdta31QmEjm9oX4jg"
GEMINI_API_KEY = "AIzaSyBdfvhY3nU2Ung11JBlErZLiwC0J2i4kNM"

# Load HF_TOKEN dynamically from environment or local git-ignored files
HF_TOKEN = os.environ.get("HF_TOKEN", "")
if not HF_TOKEN:
    run_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
    cwd_dir = os.getcwd()
    for directory in [run_dir, cwd_dir, os.path.dirname(os.path.abspath(__file__))]:
        for name in [".env", "token.env.txt"]:
            try:
                p = os.path.join(directory, name)
                if os.path.exists(p):
                    with open(p, "r", encoding="utf-8") as f:
                        for line in f:
                            if "=" in line:
                                k, v = line.split("=", 1)
                                if k.strip() in ["HF_TOKEN", "HUGGINGFACE_TOKEN"]:
                                    HF_TOKEN = v.strip().strip('"').strip("'")
                                    break
                            elif line.strip().startswith("hf_"):
                                HF_TOKEN = line.strip()
                                break
                    if HF_TOKEN:
                        break
            except Exception:
                pass
        if HF_TOKEN:
            break

MODEL_URL = "https://router.huggingface.co/v1/chat/completions"
MODEL_ID = "Qwen/Qwen2.5-72B-Instruct"

SYSTEM_INSTRUCTION = """Bạn là Chuyên gia Điều phối Sản xuất (Production Planner) thông minh tại Ortholite Việt Nam (OVN). 
NHIỆM VỤ: Phân tích dữ liệu hệ thống được cung cấp để trả lời người dùng.

TỪ ĐIỂN DỮ LIỆU:
1. Bảng 'powerapp' (Dữ liệu tổng):
   - "PRO ODER": Mã đơn hàng sản xuất (người dùng gọi là RPRO).
   - "SO": Mã vận đơn / Đơn hàng bán.
   - "Brand Code": Mã thương hiệu (NIKE, ADIDAS...).
   - "CUSTOMERS": Tên khách hàng.
   - "Total Qty": Tổng số lượng sản phẩm.
   - "Article Name": Tên sản phẩm.
   - "STATUS": Các mức level xử lý (10.RECEIVED -> 9.STORED...).
   - "Delay-Urgent": Tình trạng đơn hàng (DELAY hoặc URGENT).

2. Hệ thống 'Hàng bù' (Supplement Tracking):
   - Các công đoạn chính (Section): Dán, Cắt, Molding, DC, Molded.
   - Trạng thái (Action): IN (Bắt đầu xử lý), OUT (Hoàn thành công đoạn).
   - "Đang xử lý": Có quét IN nhưng chưa quét OUT ở công đoạn đó.
   - "Hoàn thành": Đã quét OUT.

NGUYÊN TẮC QUAN TRỌNG:
1. TUYỆT ĐỐI KHÔNG BỊA ĐẶT THÔNG TIN. Chỉ nói những gì thấy trong phần [DỮ LIỆU].
2. Nếu người dùng hỏi về "Molding", "Cắt", "Dán" trong bối cảnh "hàng bù", hãy xem dữ liệu Supplement.
3. Trả lời súc tích, chuyên nghiệp bằng tiếng Việt.
4. KHÔNG ĐƯỢC hỏi người dùng cung cấp thêm bảng dữ liệu."""

# Resolve dist directory path
if getattr(sys, 'frozen', False):
    BASE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DIST_DIR = os.path.join(BASE_DIR, 'dist')

def query_supabase(path, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    if params:
        url += f"?{params}"
    req = urllib.request.Request(url)
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode('utf-8')), response.info()
    except Exception as e:
        print(f"Supabase query error for {path}: {e}")
        return None, None

def query_supabase_count(path, query_str):
    url = f"{SUPABASE_URL}/rest/v1/{path}?{query_str}"
    req = urllib.request.Request(url)
    req.add_header("apikey", SUPABASE_KEY)
    req.add_header("Authorization", f"Bearer {SUPABASE_KEY}")
    req.add_header("Prefer", "count=exact")
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            content_range = response.headers.get("Content-Range")
            if content_range and "/" in content_range:
                return int(content_range.split("/")[-1])
    except Exception as e:
        print(f"Error querying count: {e}")
    return 0

def generate_ai_response_py(prompt, extra_context=""):
    data_context = ""
    if extra_context:
        data_context += f"[CONTEXT NGƯỜI DÙNG CUNG CẤP]:\n{extra_context}\n\n"
        
    try:
        from datetime import datetime
        today_str = datetime.now().strftime("%d/%m/%Y")
        data_context += f"[THỜI ĐIỂM BÁO CÁO]: {today_str}\n"
        
        # 1. Snapshot
        delay_count = query_supabase_count("powerapp", "Delay-Urgent=ilike.*DELAY*&select=STT")
        urgent_count = query_supabase_count("powerapp", "Delay-Urgent=ilike.*URGENT*&select=STT")
        data_context += f"[TỔNG QUAN]: {delay_count} đơn Trễ, {urgent_count} đơn Gấp.\n"
        
        query_lower = prompt.lower()
        
        # 2. Tra cứu thương hiệu
        brands = ["NIKE", "ADIDAS", "PUMA", "ASICS", "NB", "BROOKS", "ON RUNNING"]
        b_found = next((b for b in brands if b.lower() in query_lower), None)
        if b_found:
            brand_data, _ = query_supabase("powerapp", f'Brand Code=ilike.*{b_found}*&select="PRO ODER","SO","Brand Code","CUSTOMERS","Article Name","Total Qty","Delay-Urgent","Finish date"&order=STT.desc&limit=15')
            if brand_data:
                data_context += f"\n[DANH SÁCH ĐƠN {b_found}]:\n{json.dumps(brand_data, indent=2, ensure_ascii=False)}"
                
        # 3. Tra cứu theo RPRO hoặc SO
        rpro_match = re.search(r'RPRO-[\d-]+', prompt, re.IGNORECASE)
        so_match = re.search(r'SO-[\d-]+', prompt, re.IGNORECASE)
        
        if rpro_match:
            search_rpro = rpro_match.group(0).upper()
            order_data, _ = query_supabase("powerapp", f'PRO ODER=eq.{search_rpro}&limit=1')
            if order_data and len(order_data) > 0:
                data_context += f"\n\n[CHI TIẾT ĐƠN {search_rpro}]:\n{json.dumps(order_data[0], indent=2, ensure_ascii=False)}"
            
            # Tra cứu thêm tiến độ hàng bù
            trackings, _ = query_supabase("supplement_tracking", f'rpro=eq.{search_rpro}&select=section,action,scan_date&order=created_at.asc')
            if trackings:
                data_context += f"\n[TIẾN ĐỘ HÀNG BÙ {search_rpro}]:\n{json.dumps(trackings, indent=2, ensure_ascii=False)}"
        elif so_match:
            search_so = so_match.group(0).upper()
            orders_data, _ = query_supabase("powerapp", f'SO=eq.{search_so}&limit=5')
            if orders_data:
                data_context += f"\n\n[DANH SÁCH THEO SO {search_so}]:\n{json.dumps(orders_data, indent=2, ensure_ascii=False)}"
                
        # 4. Tra cứu tiến độ hàng bù
        supplement_keywords = ["bù", "supplement", "tiến độ", "molding", "cắt", "dán", "dc", "molded"]
        if any(k in query_lower for k in supplement_keywords):
            recent_trackings, _ = query_supabase("supplement_tracking", "select=*&order=created_at.desc&limit=100")
            if recent_trackings:
                sections = ['Dán', 'Cắt', 'Molding', 'DC', 'Molded']
                stats = {s: {"in": 0, "out": 0} for s in sections}
                rpro_map = {}
                
                for t in recent_trackings:
                    r = t.get("rpro")
                    s = t.get("section")
                    a = t.get("action")
                    if r and s:
                        if r not in rpro_map:
                            rpro_map[r] = {}
                        if s not in rpro_map[r]:
                            rpro_map[r][s] = {}
                        rpro_map[r][s][a] = True
                        
                rpro_details = {s: {"inProgress": [], "completed": []} for s in sections}
                for r in rpro_map:
                    for s in sections:
                        if rpro_map[r].get(s, {}).get("IN") and not rpro_map[r].get(s, {}).get("OUT"):
                            stats[s]["in"] += 1
                            rpro_details[s]["inProgress"].append(r)
                        if rpro_map[r].get(s, {}).get("OUT"):
                            stats[s]["out"] += 1
                            rpro_details[s]["completed"].append(r)
                            
                data_context += f"\n[THỐNG KÊ CHI TIẾT HÀNG BÙ (100 lệnh quét gần nhất)]:"
                for s in sections:
                    in_progress_str = ", ".join(rpro_details[s]["inProgress"]) if rpro_details[s]["inProgress"] else "Không có"
                    completed_str = ", ".join(rpro_details[s]["completed"]) if rpro_details[s]["completed"] else "Không có"
                    data_context += f"\n- CÔNG ĐOẠN {s.upper()}:\n  + Đang xử lý ({stats[s]['in']} đơn): {in_progress_str}\n  + Đã xong ({stats[s]['out']} đơn): {completed_str}"
                data_context += "\n"
    except Exception as db_err:
        print(f"Error building database context: {db_err}")
        
    # Gemini Call
    candidate_models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.0-flash-exp"]
    for model_name in candidate_models:
        try:
            print(f"Calling Gemini API model: {model_name}...")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={GEMINI_API_KEY}"
            body = {
                "contents": [
                    {
                        "parts": [
                            {
                                "text": f"{SYSTEM_INSTRUCTION}\n\n[DỮ LIỆU HỆ THỐNG]:\n{data_context}\n\n[CÂU HỎI]: {prompt}"
                            }
                        ]
                    }
                ]
            }
            req = urllib.request.Request(url, data=json.dumps(body).encode('utf-8'))
            req.add_header("Content-Type", "application/json")
            with urllib.request.urlopen(req, timeout=15) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                text = res_data['candidates'][0]['content']['parts'][0]['text']
                if text:
                    print(f"Success calling Gemini {model_name}")
                    return text
        except Exception as e:
            print(f"Gemini {model_name} failed: {e}")
            
    # Hugging Face Qwen 2.5 Call
    try:
        print("Calling Hugging Face Qwen...")
        req = urllib.request.Request(MODEL_URL)
        req.add_header("Authorization", f"Bearer {HF_TOKEN}")
        req.add_header("Content-Type", "application/json")
        body = {
            "model": MODEL_ID,
            "messages": [
                { "role": "system", "content": SYSTEM_INSTRUCTION },
                { "role": "user", "content": f"DỮ LIỆU HỆ THỐNG:\n{data_context}\n\n----------\nCÂU HỎI: {prompt}" }
            ],
            "max_tokens": 1024,
            "temperature": 0.1
        }
        with urllib.request.urlopen(req, data=json.dumps(body).encode('utf-8'), timeout=15) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            text = res_data['choices'][0]['message']['content']
            if text:
                return text
    except Exception as e:
        print(f"Hugging Face failed: {e}")
        
    return "🤖 [Hệ thống]: Không kết nối được bộ não AI (Gemini & Qwen đều quá tải). Vui lòng thử lại sau giây lát."

# Custom request handler with API endpoints and logging suppression
class QuietHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIST_DIR, **kwargs)

    def log_message(self, format, *args):
        pass  # Suppress logging

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        if self.path == '/api/chat':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                post_data = self.rfile.read(content_length)
                data = json.loads(post_data.decode('utf-8'))
                prompt = data.get('prompt', '')
                context = data.get('context', '')
                
                response_text = generate_ai_response_py(prompt, context)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                res_body = json.dumps({"response": response_text})
                self.wfile.write(res_body.encode('utf-8'))
            except Exception as e:
                print(f"Error handling /api/chat: {e}")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
            return
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        # Fallback to index.html for unknown routes (like React Router routing or general fallback)
        path = self.translate_path(self.path)
        if not os.path.exists(path) or os.path.isdir(path):
            self.path = '/index.html'
        return super().do_GET()

# Exposed Python API for file saving
class Api:
    def save_file(self, b64_data, filename):
        try:
            # Decode file contents
            file_data = base64.b64decode(b64_data)
            
            # Find the path to the Downloads folder
            downloads_dir = str(Path.home() / "Downloads")
            
            # Autorename duplicates: name.ext -> name (1).ext -> name (2).ext
            name_part, ext_part = os.path.splitext(filename)
            counter = 0
            
            target_path = os.path.join(downloads_dir, filename)
            while os.path.exists(target_path):
                counter += 1
                new_filename = f"{name_part} ({counter}){ext_part}"
                target_path = os.path.join(downloads_dir, new_filename)
            
            # Write file binary data
            with open(target_path, "wb") as f:
                f.write(file_data)
                
            return os.path.basename(target_path)
        except Exception as e:
            print(f"Error in save_file API: {e}")
            raise e

def get_free_port():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    return port

def run_server(port):
    handler = QuietHTTPRequestHandler
    httpd = socketserver.TCPServer(('127.0.0.1', port), handler)
    print(f"Serving at http://127.0.0.1:{port}")
    httpd.serve_forever()

if __name__ == '__main__':
    # Determine port
    port = get_free_port()
    
    # Start web server thread
    server_thread = threading.Thread(target=run_server, args=(port,), daemon=True)
    server_thread.start()
    
    # Initialize pywebview window
    api = Api()
    
    # Enable Webview2 selection / copy paste
    def on_loaded():
        # Inject CSS to allow text selection
        css_inject = 'body, html, * { -webkit-user-select: text !important; -moz-user-select: text !important; -ms-user-select: text !important; user-select: text !important; }'
        window.load_css(css_inject)
        
    window = webview.create_window(
        title=APP_TITLE,
        url=f'http://127.0.0.1:{port}/index.html',
        js_api=api,
        width=1280,
        height=800
    )
    
    # Start application
    webview.start(on_loaded, debug=False)
