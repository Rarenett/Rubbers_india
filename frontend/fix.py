import re

file_path = r"c:\Archana\glenda_vite\frontend\src\jsx\components\crm_new\TeleCallingDashboard.jsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Make sure style block exists
style_block = """
            <style>{`
                .telecalling-team-modal .modal-content {
                    border-radius: 16px !important;
                    border: none !important;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12) !important;
                    overflow: hidden;
                }
                .telecalling-team-modal .modal-header-custom {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 24px 28px 16px 28px;
                    border-bottom: 1px solid #f1f5f9;
                }
                .telecalling-team-modal .modal-icon-circle {
                    width: 48px;
                    height: 48px;
                    background-color: #2ece8a;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
                }
                .telecalling-team-modal .modal-close-x {
                    border: none;
                    background: transparent;
                    font-size: 24px;
                    color: #aaa;
                    cursor: pointer;
                    transition: color 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 4px;
                }
                .telecalling-team-modal .modal-close-x:hover {
                    color: #555;
                }
                .telecalling-team-modal .modal-body-custom {
                    padding: 24px 28px;
                    max-height: 55vh;
                    overflow-y: auto;
                }
                .telecalling-team-modal .modal-body-custom::-webkit-scrollbar {
                    width: 6px;
                }
                .telecalling-team-modal .modal-body-custom::-webkit-scrollbar-track {
                    background: #f1f5f9;
                    border-radius: 4px;
                }
                .telecalling-team-modal .modal-body-custom::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 4px;
                }
                .telecalling-team-modal .modal-body-custom::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
                .telecalling-team-modal .modal-footer-custom {
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding: 16px 28px 24px;
                    gap: 12px;
                    background-color: #fff;
                    border-top: 1px solid #f1f5f9;
                }
                .telecalling-team-modal .btn-close-custom {
                    background: #f1f5f9;
                    color: #475569;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-weight: 500;
                    font-size: 14px;
                    transition: all 0.2s;
                }
                .telecalling-team-modal .btn-close-custom:hover {
                    background: #e2e8f0;
                    color: #1e293b;
                }
                .telecalling-team-modal .btn-save-custom {
                    background: #2ece8a;
                    color: white;
                    border: none;
                    padding: 10px 24px;
                    border-radius: 8px;
                    font-weight: 500;
                    font-size: 14px;
                    transition: all 0.2s;
                    box-shadow: 0 4px 10px rgba(46, 206, 138, 0.2);
                    display: inline-flex;
                    align-items: center;
                }
                .telecalling-team-modal .btn-save-custom:hover {
                    background: #25b879;
                    box-shadow: 0 6px 14px rgba(46, 206, 138, 0.3);
                    transform: translateY(-1px);
                }
                .telecalling-team-modal .btn-save-custom:disabled {
                    background: #94a3b8;
                    box-shadow: none;
                    transform: none;
                    cursor: not-allowed;
                }
                .telecalling-team-modal .form-label-custom {
                    font-size: 13px;
                    font-weight: 600;
                    color: #475569;
                    margin-bottom: 8px;
                }
                .telecalling-team-modal .form-control-custom {
                    border: 1px solid #cbd5e1;
                    border-radius: 8px;
                    padding: 10px 14px;
                    font-size: 14px;
                    color: #334155;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    width: 100%;
                }
                .telecalling-team-modal .form-control-custom:focus {
                    border-color: #2ece8a;
                    box-shadow: 0 0 0 3px rgba(46, 206, 138, 0.1);
                    outline: none;
                }
            `}</style>
"""

if "telecalling-team-modal .modal-content" not in content:
    # Safely insert before final closing tags
    content = re.sub(r'(\s*</>\s*\);\s*\};\s*export default)', style_block + r'\1', content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
