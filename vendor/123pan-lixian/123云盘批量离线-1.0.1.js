// ==UserScript==
// @name         123云盘批量离线
// @description  在123云盘页面添加批量离线下载功能，支持HTTP/HTTPS/磁力链接/FTP，自动排队建立离线
// @version      1.0.1
// @match        *://*.123pan.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @license      MIT

// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        CONTAINER_ID: 'one23-batch-downloader',
        REQUEST_DELAY: 1500,
        MAX_RETRIES: 3,
        MAX_CONCURRENT: 1
    };

    // ================== 样式 ==================
    const style = document.createElement('style');
    style.innerHTML = `
        :root {
            --tm-color-white: #ffffff;
            --tm-color-text: #1f2c46;
            --tm-color-subtle: #506690;
            --tm-color-primary: #4285f4;
            --tm-color-primary-dark: #1f63ff;
            --tm-color-secondary: #1f3f72;
            --tm-color-border: #dce4f7;
            --tm-color-surface: #f7f9ff;
            --tm-color-success: #28a745;
            --tm-color-warning: #ffc107;
            --tm-color-danger: #dc3545;
            --tm-shadow-large: 0 18px 40px rgba(30, 60, 110, 0.16);
            --tm-shadow-medium: 0 12px 30px rgba(30, 60, 110, 0.12);
            --tm-border-radius: 8px;
            --tm-transition: all 0.2s ease;
        }

        /* 批量下载器主容器 */
        #${CONFIG.CONTAINER_ID} {
            position: fixed;
            top: 0px;
            left: 0px;
            width: 330px;
            max-height: 100vh;
            display: none;
            background: var(--tm-color-surface);
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            border: 1px solid var(--tm-color-border);
            transition: var(--tm-transition);
            font-size: 14px;
            overflow: hidden;
        }

        /* 头部 */
        .batch-header {
            background: linear-gradient(135deg, rgba(66, 133, 244, 0.08), rgba(66, 133, 244, 0.02));
            color: var(--tm-color-text);
            padding: 14px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--tm-color-border);
            cursor: move;
            user-select: none;
            font-weight: 600;
            font-size: 16px;
            letter-spacing: 0.2px;
        }

        .batch-header h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
            color: var(--tm-color-text);
        }

        .batch-header h3 svg {
            width: 20px;
            height: 20px;
            fill: var(--tm-color-primary);
        }

        .batch-controls {
            display: flex;
            gap: 6px;
        }

        .batch-control-btn {
            background: transparent;
            border: none;
            color: var(--tm-color-subtle);
            cursor: pointer;
            width: 24px;
            height: 24px;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            transition: var(--tm-transition);
        }

        .batch-control-btn:hover {
            background: rgba(66, 133, 244, 0.15);
            color: var(--tm-color-primary);
            transform: translateY(-1px);
        }

        .batch-settings-btn {
            font-size: 14px;
        }

        .batch-settings-btn:hover {
            background: rgba(66, 133, 244, 0.15);
            color: var(--tm-color-primary);
        }

        /* 内容区域 */
        .batch-content {
            padding: 15px 15px 20px;
            max-height: 600px;
            overflow-y: auto;
            background: var(--tm-color-white);
        }

        /* 输入区域 */
        .batch-input-area {
            margin-bottom: 16px;
        }

        .batch-textarea {
            width: 100%;
            height: 120px;
            padding: 10px;
            border: 1px solid var(--tm-color-border);
            border-radius: var(--tm-border-radius);
            font-size: 13px;
            font-family: 'Monaco', 'Menlo', monospace;
            resize: vertical;
            transition: var(--tm-transition);
            background: var(--tm-color-surface);
            line-height: 1.4;
            white-space: pre-wrap;
            word-break: break-all;
            box-sizing: border-box;
        }

        .batch-textarea:focus {
            outline: none;
            border-color: var(--tm-color-primary);
            background: var(--tm-color-white);
            box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.1);
        }

        .batch-stats {
            display: flex;
            justify-content: space-between;
            margin: 8px 0;
            font-size: 12px;
            color: var(--tm-color-subtle);
            background: var(--tm-color-surface);
            padding: 6px 10px;
            border-radius: 6px;
            border: 1px solid var(--tm-color-border);
        }

        .batch-link-types {
            display: flex;
            gap: 8px;
        }

        .batch-link-type-badge {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            padding: 1px 6px;
            border-radius: 8px;
            background: var(--tm-color-white);
            font-size: 10px;
            border: 1px solid var(--tm-color-border);
        }

        .batch-type-magnet { color: #8b5cf6; }
        .batch-type-http { color: var(--tm-color-primary); }
        .batch-type-other { color: var(--tm-color-subtle); }

        .batch-actions {
            display: flex;
            gap: 6px;
            margin-top: 10px;
            flex-wrap: nowrap;
        }

        .batch-btn {
            padding: 8px 10px;
            border: none;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: var(--tm-transition);
            display: inline-flex;
            justify-content: center;
            min-width: 0;
            gap: 4px;
            flex: 1 1 auto;
            white-space: nowrap;
        }

        .batch-btn-primary {
            background: var(--tm-color-primary);
            color: var(--tm-color-white);
        }

        .batch-btn-primary:hover:not(:disabled) {
            background: var(--tm-color-primary-dark);
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .batch-btn-secondary {
            background: var(--tm-color-surface);
            color: var(--tm-color-text);
            border: 1px solid var(--tm-color-border);
        }

        .batch-btn-secondary:hover:not(:disabled) {
            background: var(--tm-color-white);
            border-color: var(--tm-color-primary);
            transform: translateY(-1px);
        }

        .batch-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            background: #e0e0e0;
            color: #999;
            border-color: #e0e0e0;
        }
        .batch-btn:disabled:hover {
            background: #e0e0e0;
            transform: none;
        }

        /* 按钮内进度条 */
        .batch-btn-primary {
            position: relative;
            overflow: hidden;
        }

        .batch-btn-content {
            position: relative;
            z-index: 1;
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .batch-btn-primary .batch-progress-bar {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 3px;
            margin: 0;
            border-radius: 0 0 6px 6px;
            background: rgba(255, 255, 255, 0.3);
        }

        .batch-btn-primary .batch-progress-fill {
            height: 100%;
            background: #fff;
            transition: width 0.3s ease;
            border-radius: 0 0 6px 6px;
        }

        /* 任务列表 */
        .batch-tasks {
            margin-top: 16px;
            border-top: 1px solid var(--tm-color-border);
            padding-top: 12px;
        }

        .batch-tasks-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }

        .batch-tasks-title {
            font-size: 13px;
            font-weight: 600;
            color: var(--tm-color-text);
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }

        .batch-tasks-stats {
            font-size: 11px;
            color: var(--tm-color-subtle);
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        .batch-tasks-stats .stats-total,
        .batch-tasks-stats .stats-success,
        .batch-tasks-stats .stats-error {
            padding: 2px 8px;
            border-radius: 10px;
            font-weight: 500;
            cursor: pointer;
            transition: opacity 0.2s;
        }
        .batch-tasks-stats .stats-total:hover,
        .batch-tasks-stats .stats-success:hover,
        .batch-tasks-stats .stats-error:hover {
            opacity: 0.8;
        }
        .batch-tasks-stats .stats-total {
            background: rgba(0, 0, 0, 0.08);
            color: var(--tm-color-text);
        }
        .batch-tasks-stats .stats-success {
            background: rgba(40, 167, 69, 0.15);
            color: var(--tm-color-success);
        }
        .batch-tasks-stats .stats-error {
            background: rgba(220, 53, 69, 0.15);
            color: var(--tm-color-danger);
        }

        .batch-task-item {
            background: var(--tm-color-surface);
            border-radius: var(--tm-border-radius);
            padding: 10px;
            margin-bottom: 8px;
            border: 1px solid var(--tm-color-border);
            border-left-width: 3px;
            transition: var(--tm-transition);
        }

        .batch-task-item.waiting {
            border-left-color: var(--tm-color-warning);
            background: rgba(255, 193, 7, 0.05);
        }

        .batch-task-item.downloading {
            border-left-color: var(--tm-color-primary);
            background: rgba(66, 133, 244, 0.05);
            position: relative;
            overflow: hidden;
        }
        .batch-task-item.downloading .task-progress-bar {
            position: absolute;
            left: 0;
            bottom: 0;
            height: 3px;
            background: var(--tm-color-primary);
            transition: width 0.3s ease;
        }

        .batch-task-item.success {
            border-left-color: var(--tm-color-success);
            background: rgba(40, 167, 69, 0.05);
        }

        .batch-task-item.error {
            border-left-color: var(--tm-color-danger);
            background: rgba(220, 53, 69, 0.05);
        }

        .batch-task-info {
            min-width: 0;
        }

        .batch-task-name {
            font-weight: 500;
            color: var(--tm-color-text);
            font-size: 12px;
            word-break: break-all;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1.3;
            margin-bottom: 3px;
        }

        .batch-task-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 10px;
            color: var(--tm-color-subtle);
            margin-top: 4px;
            gap: 10px;
        }

        .batch-task-type {
            padding: 1px 4px;
            border-radius: 3px;
            background: rgba(0,0,0,0.05);
            text-transform: uppercase;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            height: 18px;
        }

        .batch-task-status {
            font-size: 10px;
            padding: 1px 6px;
            border-radius: 8px;
            background: rgba(0,0,0,0.05);
            white-space: nowrap;
            display: inline-flex;
            align-items: center;
            gap: 3px;
            height: 18px;
        }

        .batch-task-progress {
            font-size: 10px;
            color: var(--tm-color-subtle);
            display: flex;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
        }

        .batch-task-retry {
            color: var(--tm-color-primary);
            cursor: pointer;
            font-size: 10px;
            padding: 1px 6px;
            border-radius: 8px;
            background: rgba(66, 133, 244, 0.1);
            display: inline-flex;
            align-items: center;
            gap: 3px;
            height: 18px;
        }

        .batch-task-retry:hover {
            background: rgba(66, 133, 244, 0.2);
        }

        .batch-task-error {
            color: var(--tm-color-danger);
            font-size: 10px;
            margin-top: 4px;
            padding: 3px 6px;
            background: rgba(220, 53, 69, 0.1);
            border-radius: 3px;
            word-break: break-word;
        }

        /* 进度条 */
        .batch-progress-bar {
            height: 3px;
            background: var(--tm-color-border);
            border-radius: 1px;
            margin: 8px 0 3px;
            overflow: hidden;
        }

        .batch-progress-fill {
            height: 100%;
            background: var(--tm-color-primary);
            transition: width 0.2s ease;
            border-radius: 1px;
        }

        /* 提示框 */
        .batch-toast {
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 20px;
            background: #1f2c46;
            color: #ffffff;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 400;
            z-index: 1000000;
            animation: slideInTop 0.3s;
            max-width: 360px;
            word-break: break-word;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .batch-toast.batch-toast-success {
            background: #059669;
        }
        .batch-toast.batch-toast-error {
            background: #dc2626;
        }
        .batch-toast.batch-toast-warning {
            background: #d97706;
        }
        .batch-toast svg {
            width: 16px;
            height: 16px;
            flex-shrink: 0;
        }

        @keyframes slideInTop {
            from {
                transform: translate(-50%, -100%);
                opacity: 0;
            }
            to {
                transform: translate(-50%, 0);
                opacity: 1;
            }
        }

        /* 设置弹窗 */
        .batch-settings-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000000;
        }

        .batch-settings-modal.hidden {
            display: none;
        }

        .batch-settings-content {
            background: var(--tm-color-white);
            border-radius: 12px;
            padding: 24px;
            width: 300px;
            box-shadow: var(--tm-shadow-large);
        }

        .batch-settings-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 20px;
            color: var(--tm-color-text);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .batch-settings-close {
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: var(--tm-color-subtle);
            padding: 4px;
            line-height: 1;
        }

        .batch-settings-close:hover {
            color: var(--tm-color-text);
        }

        .batch-settings-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        }

        .batch-settings-label {
            font-size: 14px;
            color: var(--tm-color-text);
        }

        .batch-settings-input {
            width: 80px;
            padding: 8px 12px;
            border: 1px solid var(--tm-color-border);
            border-radius: 6px;
            font-size: 14px;
            text-align: center;
        }

        .batch-settings-input:focus {
            outline: none;
            border-color: var(--tm-color-primary);
        }

        .batch-settings-save {
            width: 100%;
            padding: 10px;
            background: var(--tm-color-primary);
            color: var(--tm-color-white);
            border: none;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            margin-top: 10px;
        }

        .batch-settings-save:hover {
            background: var(--tm-color-primary-dark);
        }
    `;
    document.head.appendChild(style);

    // ================== SVG图标函数 ==================
    const SVG_ICONS = {
        key: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`,
        check: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
        x: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
        clock: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
        trash: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
        list: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
        box: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
        magnet: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 15-4-4 6.75-6.77a7.79 7.79 0 0 1 11 11L13 22l-4-4 6.39-6.36a2.14 2.14 0 0 0-3-3L6 15"/><path d="m5 8 4 4"/><path d="m12 15 4 4"/></svg>`,
        globe: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
        download: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
        settings: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,
        paste: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>`,
        play: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
        party: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5.8 11.3L2 22l10.7-3.8"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11v0c-.11.7-.72 1.22-1.43 1.22H17"/></svg>`
    };

    function icon(name) {
        return SVG_ICONS[name] || '';
    }

    // ================== 工具函数 ==================
    function detectLinkType(url) {
        if (!url) return 'unknown';
        if (url.startsWith('magnet:')) return 'magnet';
        if (url.startsWith('http:') || url.startsWith('https:')) return 'http';
        if (url.startsWith('ftp:')) return 'ftp';
        if (url.startsWith('thunder:')) return 'thunder';
        if (url.startsWith('ed2k:')) return 'ed2k';
        return 'other';
    }

    function getFileNameFromUrl(url) {
        try {
            const type = detectLinkType(url);

            if (type === 'magnet') {
                const dnMatch = url.match(/dn=([^&]+)/);
                if (dnMatch) return decodeURIComponent(dnMatch[1]);

                const xtMatch = url.match(/xt=urn:btih:([^&]+)/);
                if (xtMatch) return `[磁力] ${xtMatch[1].substring(0, 8)}...`;

                return '磁力链接';
            }

            if (type === 'http' || type === 'ftp') {
                const urlObj = new URL(url);
                let filename = decodeURIComponent(urlObj.pathname.split('/').pop() || '');

                if (!filename || filename === '/' || filename.includes('?')) {
                    filename = urlObj.hostname + urlObj.pathname.replace(/\//g, '_');
                }

                if (filename.length > 50) {
                    filename = filename.substring(0, 47) + '...';
                }

                return filename;
            }

            return url.substring(0, 40) + '...';
        } catch {
            return url.substring(0, 40) + '...';
        }
    }

    // ================== 下载器类 ==================
    class BatchDownloader {
        constructor() {
            this.tasks = [];
            this.currentIndex = 0;
            this.isProcessing = false;
            this.isPaused = false;
            this.token = this.getToken();
            this.container = null;
            this.dragOffset = { x: 0, y: 0 };
            this.elements = {};
            this.init();
        }

        getToken() {
            let token = localStorage.getItem('authorToken');
            if (!token) {
                try {
                    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
                    token = userInfo.token;
                } catch(e) {}
            }

            if (!token) {
                const cookies = document.cookie.split(';');
                for (let cookie of cookies) {
                    const [name, value] = cookie.trim().split('=');
                    if (name.includes('token') || name.includes('Token')) {
                        token = value;
                        break;
                    }
                }
            }

            return token;
        }

        init() {
            this.createUI();

            setInterval(() => {
                const newToken = this.getToken();
                if (newToken !== this.token) {
                    this.token = newToken;
                    this.showToast('Token已更新', 2000);
                }
            }, 10000);
        }

        createUI() {
            this.container = document.createElement('div');
            this.container.id = CONFIG.CONTAINER_ID;

            const header = document.createElement('div');
            header.className = 'batch-header';
            header.innerHTML = `
                <h3>
                    <svg viewBox="0 0 24 24" width="20" height="20">
                        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                    </svg>
                    批量离线下载
                </h3>
                <div class="batch-controls">
                    <button class="batch-control-btn batch-settings-btn" id="batch-settings" title="设置">${icon('settings')}</button>
                    <button class="batch-control-btn" id="batch-close">×</button>
                </div>
            `;

            const content = document.createElement('div');
            content.className = 'batch-content';
            content.innerHTML = `
                <div class="batch-input-area">
                    <textarea class="batch-textarea" title="在此输入或粘贴内容，每行一个" placeholder="支持多种链接，每行一个：
磁力: magnet:?xt=urn:btih:...
HTTP: https://example.com/file.mp4
FTP: ftp://example.com/file.iso"></textarea>

                    <div class="batch-stats">
                        <span id="batch-link-count">0 个内容</span>
                        <div class="batch-link-types">
                            <span class="batch-link-type-badge batch-type-magnet" id="magnet-count" title="磁力链接">${icon('magnet')} 0</span>
                            <span class="batch-link-type-badge batch-type-http" id="http-count" title="HTTP/HTTPS 链接">${icon('globe')} 0</span>
                            <span class="batch-link-type-badge batch-type-other" id="other-count" title="其他类型链接(FTP等)">${icon('box')} 0</span>
                        </div>
                    </div>

                    <div class="batch-actions">
                        <button class="batch-btn batch-btn-primary" id="batch-start" title="开始批量建立离线任务">
                            <div class="batch-btn-content">
                                ${icon('play')} 开始
                            </div>
                            <div class="batch-progress-bar" id="global-progress" style="display: none;">
                                <div class="batch-progress-fill" style="width: 0%;"></div>
                            </div>
                        </button>
                        <button class="batch-btn batch-btn-secondary" id="batch-pause" title="暂停建立" style="display: none;">
                            <span>${icon('clock')} 暂停
                        </button>
                        <button class="batch-btn batch-btn-secondary" id="batch-paste" title="从剪贴板粘贴链接">
                            <span>${icon('paste')}</span> 粘贴
                        </button>
                        <button class="batch-btn batch-btn-secondary" id="batch-clear" title="清空输入框中的所有链接">
                            <span>${icon('trash')}</span> 清空
                        </button>
                    </div>
                </div>

                <div class="batch-tasks">
                    <div class="batch-tasks-header">
                        <span class="batch-tasks-title">${icon('list')} 任务队列</span>
                        <span class="batch-tasks-stats" id="task-stats">0/0</span>
                    </div>
                    <div id="task-list" style="max-height: 320px; overflow-y: auto;"></div>
                </div>
            `;

            this.container.appendChild(header);
            this.container.appendChild(content);
            document.body.appendChild(this.container);

            this.elements = {
                textarea: document.querySelector('.batch-textarea'),
                taskList: document.getElementById('task-list'),
                taskStats: document.getElementById('task-stats'),
                startBtn: document.getElementById('batch-start'),
                pauseBtn: document.getElementById('batch-pause'),
                pasteBtn: document.getElementById('batch-paste'),
                clearBtn: document.getElementById('batch-clear'),
                globalProgress: document.getElementById('global-progress'),
                batchLinkCount: document.getElementById('batch-link-count'),
                magnetCount: document.getElementById('magnet-count'),
                httpCount: document.getElementById('http-count'),
                otherCount: document.getElementById('other-count')
            };

            const statsEl = document.getElementById('task-stats');
            if (statsEl) {
                statsEl.addEventListener('click', (e) => {
                    const target = e.target;
                    if (target.classList.contains('stats-total')) {
                        this.copyTasksByStatus('all');
                    } else if (target.classList.contains('stats-success')) {
                        this.copyTasksByStatus('success');
                    } else if (target.classList.contains('stats-error')) {
                        this.copyTasksByStatus('error');
                    }
                });
            }

            this.settingsModal = document.createElement('div');
            this.settingsModal.className = 'batch-settings-modal hidden';
            this.settingsModal.innerHTML = `
                <div class="batch-settings-content">
                    <div class="batch-settings-title">
                        <span>设置</span>
                        <button class="batch-settings-close" id="settings-close">×</button>
                    </div>
                    <div class="batch-settings-item">
                        <span class="batch-settings-label">重试次数</span>
                        <input type="number" class="batch-settings-input" id="settings-retries" value="${CONFIG.MAX_RETRIES}" min="1" max="999">
                    </div>
                    <div class="batch-settings-item">
                        <span class="batch-settings-label">请求延迟(毫秒)</span>
                        <input type="number" class="batch-settings-input" id="settings-delay" value="${CONFIG.REQUEST_DELAY}" min="100" max="10000">
                    </div>
                    <div class="batch-settings-item">
                        <span class="batch-settings-label">同时进行数量</span>
                        <input type="number" class="batch-settings-input" id="settings-concurrent" value="${CONFIG.MAX_CONCURRENT}" min="1" max="10">
                    </div>
                    <button class="batch-settings-save" id="settings-save">保存设置</button>
                </div>
            `;
            document.body.appendChild(this.settingsModal);

            this.bindEvents();
            this.makeDraggable(header);

            this.updateLinkStats();
        }

        bindEvents() {
            document.getElementById('batch-close').onclick = () => {
                this.container.style.display = 'none';
            };

            document.getElementById('batch-settings').onclick = () => {
                document.getElementById('settings-retries').value = CONFIG.MAX_RETRIES;
                document.getElementById('settings-delay').value = CONFIG.REQUEST_DELAY;
                document.getElementById('settings-concurrent').value = CONFIG.MAX_CONCURRENT;
                
                document.getElementById('settings-retries').style.borderColor = '';
                document.getElementById('settings-delay').style.borderColor = '';
                document.getElementById('settings-concurrent').style.borderColor = '';
                
                this.settingsModal.classList.remove('hidden');
            };

            document.getElementById('settings-close').onclick = () => {
                this.settingsModal.classList.add('hidden');
            };

            this.settingsModal.onclick = (e) => {
                if (e.target === this.settingsModal) {
                    this.settingsModal.classList.add('hidden');
                }
            };

            document.getElementById('settings-save').onclick = () => {
                const retriesInput = document.getElementById('settings-retries');
                const delayInput = document.getElementById('settings-delay');
                const concurrentInput = document.getElementById('settings-concurrent');
                
                const retries = parseInt(retriesInput.value);
                const delay = parseInt(delayInput.value);
                const concurrent = parseInt(concurrentInput.value);
                
                retriesInput.style.borderColor = '';
                delayInput.style.borderColor = '';
                concurrentInput.style.borderColor = '';
                
                let hasError = false;
                
                if (isNaN(retries) || retries < 1 || retries > 999) {
                    retriesInput.style.borderColor = '#dc3545';
                    hasError = true;
                }
                
                if (isNaN(delay) || delay < 100 || delay > 10000) {
                    delayInput.style.borderColor = '#dc3545';
                    hasError = true;
                }
                
                if (isNaN(concurrent) || concurrent < 1 || concurrent > 10) {
                    concurrentInput.style.borderColor = '#dc3545';
                    hasError = true;
                }
                
                if (hasError) {
                    if (isNaN(retries) && isNaN(delay) && isNaN(concurrent)) {
                        this.showToast('请输入有效的数字');
                    } else if (isNaN(retries)) {
                        this.showToast('重试次数请输入有效数字');
                    } else if (isNaN(delay)) {
                        this.showToast('请求延迟请输入有效数字');
                    } else if (isNaN(concurrent)) {
                        this.showToast('同时进行数量请输入有效数字');
                    } else if (retries < 1 || retries > 999) {
                        this.showToast('重试次数请输入1-999之间的数字');
                    } else if (delay < 100 || delay > 10000) {
                        this.showToast('请求延迟请输入100-10000之间的数字');
                    } else if (concurrent < 1 || concurrent > 10) {
                        this.showToast('同时进行数量请输入1-10之间的数字');
                    }
                    return;
                }
                
                CONFIG.MAX_RETRIES = retries;
                CONFIG.REQUEST_DELAY = delay;
                CONFIG.MAX_CONCURRENT = concurrent;
                GM_setValue('maxRetries', retries);
                GM_setValue('requestDelay', delay);
                GM_setValue('maxConcurrent', concurrent);
                
                this.settingsModal.classList.add('hidden');
                this.showToast(`设置已保存：重试次数 ${retries} 次，延迟 ${delay} 毫秒，同时进行 ${concurrent} 个任务`);
            };

            const savedRetries = GM_getValue('maxRetries');
            if (savedRetries) {
                CONFIG.MAX_RETRIES = savedRetries;
            }
            
            const savedDelay = GM_getValue('requestDelay');
            if (savedDelay) {
                CONFIG.REQUEST_DELAY = savedDelay;
            }
            
            const savedConcurrent = GM_getValue('maxConcurrent');
            if (savedConcurrent) {
                CONFIG.MAX_CONCURRENT = savedConcurrent;
            }

            document.getElementById('batch-paste').onclick = async () => {
                try {
                    const text = await navigator.clipboard.readText();
                    const { textarea } = this.elements;
                    textarea.value = text;
                    this.updateLinkStats();
                    this.updateTasksFromTextarea();
                    this.showToast('已粘贴剪贴板内容');
                } catch (err) {
                    this.showToast('无法读取剪贴板，请手动粘贴');
                }
            };

            document.getElementById('batch-clear').onclick = () => {
                const { textarea } = this.elements;
                if (textarea) textarea.value = '';
                this.tasks = [];
                this.updateLinkStats();
                this.renderTaskList();
            };

            document.getElementById('batch-start').onclick = () => {
                if (this.isProcessing) {
                    this.cancelDownload();
                } else {
                    if (!this.token) {
                        this.showToast('请先登录123云盘');
                        return;
                    }
                    this.startDownload();
                }
            };

            document.getElementById('batch-pause').onclick = () => {
                if (this.isPaused) {
                    this.isPaused = false;
                    const pauseBtn = document.getElementById('batch-pause');
                    if (pauseBtn) {
                        pauseBtn.innerHTML = '<span>' + icon('clock') + ' 暂停</span>';
                    }
                    this.showToast('已继续建立');
                    this.processNextTask();
                } else {
                    this.isPaused = true;
                    const pauseBtn = document.getElementById('batch-pause');
                    if (pauseBtn) {
                        pauseBtn.innerHTML = '<span>' + icon('play') + ' 继续</span>';
                    }
                    this.showToast('已暂停建立');
                }
            };

            this.elements.textarea.addEventListener('input', () => {
                this.updateLinkStats();
                this.updateTasksFromTextarea();
            });
        }

        updateTasksFromTextarea() {
            const { textarea } = this.elements;
            if (!textarea) return;
            
            const text = textarea.value;
            const links = text.split('\n').filter(l => l.trim());
            
            this.tasks = links.map((link, index) => ({
                id: Date.now() + index,
                url: link,
                name: getFileNameFromUrl(link),
                type: detectLinkType(link),
                status: 'waiting',
                progress: 0,
                retryCount: 0,
                error: null,
                fileInfo: null
            }));
            
            this.renderTaskList();
        }

        updateLinkStats() {
            const { textarea, batchLinkCount, magnetCount, httpCount, otherCount } = this.elements;
            if (!textarea) return;
            
            const links = textarea.value.split('\n').filter(l => l.trim());
            let magnetCountVal = 0, httpCountVal = 0, otherCountVal = 0;

            links.forEach(link => {
                const type = detectLinkType(link.trim());
                if (type === 'magnet') magnetCountVal++;
                else if (type === 'http' || type === 'ftp') httpCountVal++;
                else if (type !== 'unknown') otherCountVal++;
            });

            if (batchLinkCount) batchLinkCount.textContent = `${links.length} 个内容`;
            if (magnetCount) magnetCount.innerHTML = `${icon('magnet')} ${magnetCountVal}`;
            if (httpCount) httpCount.innerHTML = `${icon('globe')} ${httpCountVal}`;
            if (otherCount) otherCount.innerHTML = `${icon('box')} ${otherCountVal}`;
        }

        makeDraggable(handle) {
            let isDragging = false;

            handle.onmousedown = (e) => {
                if (e.target.tagName === 'BUTTON') return;
                isDragging = true;
                const rect = this.container.getBoundingClientRect();
                this.dragOffset.x = e.clientX - rect.left;
                this.dragOffset.y = e.clientY - rect.top;
                this.container.style.transition = 'none';
                this.container.style.cursor = 'grabbing';
            };

            document.onmousemove = (e) => {
                if (!isDragging) return;
                const x = Math.max(0, Math.min(window.innerWidth - this.container.offsetWidth, e.clientX - this.dragOffset.x));
                const y = Math.max(0, Math.min(window.innerHeight - this.container.offsetHeight, e.clientY - this.dragOffset.y));
                this.container.style.left = x + 'px';
                this.container.style.top = y + 'px';
                this.container.style.right = 'auto';
                this.container.style.bottom = 'auto';
            };

            document.onmouseup = () => {
                isDragging = false;
                this.container.style.transition = '';
                this.container.style.cursor = '';
            };
        }

        parseLinks() {
            const textarea = document.querySelector('.batch-textarea');
            return textarea.value.split('\n')
                .map(link => link.trim())
                .filter(link => {
                    if (!link) return false;
                    const type = detectLinkType(link);
                    return type !== 'unknown';
                });
        }

        async startDownload() {
            const links = this.parseLinks();

            if (links.length === 0) {
                this.showToast('没有有效的链接');
                return;
            }

            const startBtn = document.getElementById('batch-start');
            const pasteBtn = document.getElementById('batch-paste');
            const clearBtn = document.getElementById('batch-clear');
            const textarea = document.querySelector('.batch-textarea');
            if (textarea) textarea.disabled = true;
            if (startBtn) {
                startBtn.disabled = false;
                const btnContent = startBtn.querySelector('.batch-btn-content');
                if (btnContent) {
                    btnContent.innerHTML = icon('x') + ' 取消';
                }
            }
            if (pasteBtn) pasteBtn.disabled = true;
            if (clearBtn) clearBtn.disabled = true;

            const pauseBtn = document.getElementById('batch-pause');
            if (pauseBtn) {
                pauseBtn.style.display = 'inline-flex';
            }
            this.isPaused = false;

            this.tasks = links.map((link, index) => ({
                id: Date.now() + index,
                url: link,
                type: detectLinkType(link),
                name: getFileNameFromUrl(link),
                status: 'waiting',
                progress: 0,
                error: null,
                retryCount: 0,
                fileInfo: null
            }));

            this.renderTaskList();

            document.getElementById('global-progress').style.display = 'block';

            if (!this.isProcessing) {
                this.isProcessing = true;
                await this.processNextTask();
            }
        }

        async processNextTask() {
            const maxConcurrent = CONFIG.MAX_CONCURRENT;
            let activeTasks = 0;
            let currentIndex = 0;

            const processTask = async (task) => {
                if (task.status === 'waiting' || (task.status === 'error' && task.retryCount < CONFIG.MAX_RETRIES)) {
                    task.status = 'downloading';
                    task.startTime = Date.now();
                    this.renderTaskList();

                    try {
                        this.showToast(`开始建立: ${task.name}`, 2000);
                        await this.downloadTask(task);

                        task.status = 'success';
                        task.progress = 100;
                        task.error = null;
                        task.endTime = Date.now();

                        const duration = ((task.endTime - task.startTime) / 1000).toFixed(1);
                        this.showToast(`建立成功: ${task.name} (${duration}s)`);

                    } catch (error) {
                        task.status = 'error';
                        task.error = error.message || error;
                        task.retryCount++;

                        if (task.retryCount < CONFIG.MAX_RETRIES) {
                            task.status = 'waiting';
                            this.showToast(`建立失败，${task.retryCount}/${CONFIG.MAX_RETRIES} 次重试`, 3000);
                        } else {
                            this.showToast(`建立失败: ${task.name}`, 3000);
                        }
                    }

                    this.renderTaskList();
                    this.updateGlobalProgress();
                }
            };

            const processTasks = async () => {
                while (currentIndex < this.tasks.length && this.isProcessing) {
                    while (this.isPaused && this.isProcessing) {
                        await this.delay(500);
                    }
                    if (!this.isProcessing) break;

                    if (activeTasks < maxConcurrent) {
                        const task = this.tasks[currentIndex];
                        currentIndex++;
                        activeTasks++;

                        processTask(task).finally(() => {
                            activeTasks--;
                        });

                        await this.delay(CONFIG.REQUEST_DELAY);
                    } else {
                        await this.delay(100);
                    }
                }

                while (activeTasks > 0 && this.isProcessing) {
                    await this.delay(100);
                }

                const hasRetryTasks = this.tasks.some(t => t.status === 'waiting' && t.retryCount > 0);
                if (hasRetryTasks && this.isProcessing) {
                    currentIndex = 0;
                    await processTasks();
                } else if (this.isProcessing) {
                    this.isProcessing = false;
                    const successCount = this.tasks.filter(t => t.status === 'success').length;
                    this.showToast(`全部完成！成功: ${successCount}/${this.tasks.length}`);

                    const startBtn = document.getElementById('batch-start');
                    const pasteBtn = document.getElementById('batch-paste');
                    const clearBtn = document.getElementById('batch-clear');
                    if (startBtn) {
                        startBtn.disabled = false;
                        startBtn.innerHTML = '<div class="batch-btn-content">' + icon('play') + ' 开始</div><div class="batch-progress-bar" id="global-progress" style="display: none;"><div class="batch-progress-fill" style="width: 0%;"></div></div>';
                    }
                    if (pasteBtn) pasteBtn.disabled = false;
                    if (clearBtn) clearBtn.disabled = false;
                    const textarea = document.querySelector('.batch-textarea');
                    if (textarea) textarea.disabled = false;
                    const pauseBtn = document.getElementById('batch-pause');
                    if (pauseBtn) pauseBtn.style.display = 'none';
                }
            };

            await processTasks();
        }

        cancelDownload() {
            this.isProcessing = false;
            this.isPaused = false;
            
            const startBtn = document.getElementById('batch-start');
            const pasteBtn = document.getElementById('batch-paste');
            const clearBtn = document.getElementById('batch-clear');
            const textarea = document.querySelector('.batch-textarea');
            const pauseBtn = document.getElementById('batch-pause');
            
            if (startBtn) {
                startBtn.disabled = false;
                startBtn.innerHTML = '<div class="batch-btn-content">' + icon('play') + ' 开始</div><div class="batch-progress-bar" id="global-progress" style="display: none;"><div class="batch-progress-fill" style="width: 0%;"></div></div>';
            }
            if (pasteBtn) pasteBtn.disabled = false;
            if (clearBtn) clearBtn.disabled = false;
            if (textarea) textarea.disabled = false;
            if (pauseBtn) pauseBtn.style.display = 'none';
            
            this.showToast('已取消建立');
            this.renderTaskList();
        }

        async downloadTask(task) {
            return new Promise(async (resolve, reject) => {
                try {
                    task.progress = 10;
                    this.renderTaskList();

                    const resolveData = await this.resolveUrl(task.url);

                    task.progress = 40;
                    task.fileInfo = resolveData;
                    this.renderTaskList();

                    const submitData = await this.submitTask(resolveData);

                    task.progress = 90;
                    this.renderTaskList();

                    await this.delay(1000);

                    task.progress = 100;
                    resolve(submitData);

                } catch (error) {
                    if (error === 'TOKEN_EXPIRED') {
                        this.token = this.getToken();
                        if (this.token) {
                            return this.downloadTask(task);
                        }
                    }
                    reject(error);
                }
            });
        }

        async resolveUrl(url) {
            return new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: 'https://www.123pan.com/b/api/v2/offline_download/task/resolve',
                    headers: {
                        'Authorization': 'Bearer ' + this.token,
                        'App-Version': '3',
                        'platform': 'web',
                        'Content-Type': 'application/json;charset=UTF-8',
                        'Origin': 'https://www.123pan.com',
                        'Referer': 'https://www.123pan.com/'
                    },
                    data: JSON.stringify({ urls: url }),
                    onload: (response) => {
                        if (response.status === 401) {
                            reject('TOKEN_EXPIRED');
                            return;
                        }

                        try {
                            const data = JSON.parse(response.responseText);
                            if (data.code === 0) {
                                if (data.data && data.data.list && data.data.list.length > 0) {
                                    resolve(data.data.list[0]);
                                } else {
                                    reject('解析成功但无数据');
                                }
                            } else {
                                reject(data.message || `解析失败 (${data.code})`);
                            }
                        } catch (e) {
                            reject('响应解析失败: ' + e.message);
                        }
                    },
                    onerror: (err) => reject('网络请求失败: ' + err)
                });
            });
        }

        async submitTask(taskInfo) {
            return new Promise((resolve, reject) => {
                if (!taskInfo.files || taskInfo.files.length === 0) {
                    reject('没有可建立离线的文件');
                    return;
                }

                const fileIds = taskInfo.files.map(f => f.id);
                const totalSize = taskInfo.files.reduce((sum, f) => sum + (f.size || 0), 0);

                GM_xmlhttpRequest({
                    method: 'POST',
                    url: 'https://www.123pan.com/b/api/v2/offline_download/task/submit',
                    headers: {
                        'Authorization': 'Bearer ' + this.token,
                        'App-Version': '3',
                        'platform': 'web',
                        'Content-Type': 'application/json;charset=UTF-8'
                    },
                    data: JSON.stringify({
                        resource_list: [{
                            resource_id: taskInfo.id,
                            select_file_id: fileIds
                        }]
                    }),
                    onload: (response) => {
                        try {
                            const data = JSON.parse(response.responseText);
                            if (data.code === 0) {
                                resolve({
                                    ...data,
                                    fileCount: fileIds.length,
                                    totalSize: totalSize
                                });
                            } else {
                                reject(data.message || '提交失败');
                            }
                        } catch (e) {
                            reject('响应解析失败');
                        }
                    },
                    onerror: () => reject('网络请求失败')
                });
            });
        }

        renderTaskList() {
            const taskList = document.getElementById('task-list');
            if (!taskList) return;

            if (this.tasks.length === 0) {
                taskList.innerHTML = '<div style="text-align: center; color: #94a3b8; padding: 30px 20px;">暂无任务</div>';
                document.getElementById('task-stats').innerHTML = '<span class="stats-total" title="点击复制全部链接" onclick="downloader.copyTasksByStatus(\'all\')">0</span><span class="stats-success" title="点击复制成功链接" onclick="downloader.copyTasksByStatus(\'success\')">0</span><span class="stats-error" title="点击复制失败链接" onclick="downloader.copyTasksByStatus(\'error\')">0</span>';
                return;
            }

            const successCount = this.tasks.filter(t => t.status === 'success').length;
            const errorCount = this.tasks.filter(t => t.status === 'error').length;
            document.getElementById('task-stats').innerHTML = `<span class="stats-total" title="点击复制全部链接" onclick="downloader.copyTasksByStatus('all')">${this.tasks.length}</span><span class="stats-success" title="点击复制成功链接" onclick="downloader.copyTasksByStatus('success')">${successCount}</span><span class="stats-error" title="点击复制失败链接" onclick="downloader.copyTasksByStatus('error')">${errorCount}</span>`;

            taskList.innerHTML = this.tasks.map((task, index) => `
                <div class="batch-task-item ${task.status}" id="task-item-${task.id}" ${task.status === 'downloading' ? `style="position: relative; overflow: hidden;"` : ''}>
                    ${task.status === 'downloading' ? `<div class="task-progress-bar" style="width: ${task.progress}%;"></div>` : ''}
                    <div class="batch-task-info">
                        <div class="batch-task-name" title="${task.url}">${task.name}</div>
                        <div class="batch-task-meta">
                            <div style="display: flex; gap: 6px; align-items: center;">
                                <span class="batch-task-type" title="类型: ${task.type}&#10;链接: ${task.url}">${task.type}</span>
                                <span class="batch-task-status" ${task.error ? `title="${task.error}" style="cursor: help;"` : ''}>${this.getStatusText(task)}</span>
                            </div>
                            <div class="batch-task-progress">
                                ${task.progress > 0 && task.status !== 'success' ? `<span>${task.progress}%</span>` : ''}
                                ${task.status === 'error' ? `<span style="color: #f59e0b;">重试 ${task.retryCount}/${CONFIG.MAX_RETRIES}</span>` : ''}
                                ${task.status === 'error' ?
                                    `<span class="batch-task-retry" onclick="downloader.retryTask(${task.id})" title="点击重新尝试建立离线">${icon('clock')} 重试</span>` :
                                    ''}
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');

            const currentTask = this.tasks.find(t => t.status === 'downloading');
            if (currentTask) {
                const taskElement = document.getElementById(`task-item-${currentTask.id}`);
                if (taskElement) {
                    taskElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        }

        updateGlobalProgress() {
            if (this.tasks.length === 0) return;

            const totalProgress = this.tasks.reduce((sum, t) => sum + t.progress, 0) / this.tasks.length;
            const fill = document.querySelector('#global-progress .batch-progress-fill');
            if (fill) {
                fill.style.width = totalProgress + '%';
            }
        }

        getStatusText(task) {
            const statusMap = {
                'waiting': `${icon('clock')} 等待`,
                'downloading': `${icon('download')} 建立中`,
                'success': `${icon('check')} 完成`,
                'error': `${icon('x')} 失败`
            };
            return statusMap[task.status] || task.status;
        }

        async retryTask(taskId) {
            const task = this.tasks.find(t => t.id === taskId);
            if (!task) return;

            task.status = 'waiting';
            task.error = null;
            task.progress = 0;
            task.fileInfo = null;
            task.retryCount = 0;
            this.renderTaskList();

            const wasProcessing = this.isProcessing;
            this.isProcessing = true;
            this.currentIndex = this.tasks.findIndex(t => t.id === taskId);

            if (this.currentIndex >= 0) {
                const originalMaxRetries = CONFIG.MAX_RETRIES;
                CONFIG.MAX_RETRIES = 1;

                while (this.currentIndex < this.tasks.length) {
                    const currentTask = this.tasks[this.currentIndex];

                    if (currentTask.id !== taskId) break;

                    currentTask.status = 'downloading';
                    currentTask.startTime = Date.now();
                    this.renderTaskList();

                    try {
                        this.showToast(`开始重试: ${currentTask.name}`, 2000);
                        await this.downloadTask(currentTask);

                        currentTask.status = 'success';
                        currentTask.progress = 100;
                        currentTask.error = null;
                        currentTask.endTime = Date.now();

                        const duration = ((currentTask.endTime - currentTask.startTime) / 1000).toFixed(1);
                        this.showToast(`重试成功: ${currentTask.name} (${duration}s)`);
                        break;

                    } catch (error) {
                        currentTask.status = 'error';
                        currentTask.error = error.message || error;
                        currentTask.retryCount++;

                        this.showToast(`重试失败: ${currentTask.name}`, 3000);
                    }

                    this.renderTaskList();
                    this.updateGlobalProgress();
                    break;
                }

                CONFIG.MAX_RETRIES = originalMaxRetries;
            }

            if (!wasProcessing) {
                this.isProcessing = false;
                const successCount = this.tasks.filter(t => t.status === 'success').length;
                const hasMore = this.tasks.some(t => t.status === 'waiting');
                if (!hasMore) {
                    this.showToast(`全部完成！成功: ${successCount}/${this.tasks.length}`);
                    const startBtn = document.getElementById('batch-start');
                    const pasteBtn = document.getElementById('batch-paste');
                    const clearBtn = document.getElementById('batch-clear');
                    if (startBtn) {
                        startBtn.disabled = false;
                        startBtn.innerHTML = '<div class="batch-btn-content">' + icon('play') + ' 开始</div><div class="batch-progress-bar" id="global-progress" style="display: none;"><div class="batch-progress-fill" style="width: 0%;"></div></div>';
                    }
                    if (pasteBtn) pasteBtn.disabled = false;
                    if (clearBtn) clearBtn.disabled = false;
                    const textarea = document.querySelector('.batch-textarea');
                    if (textarea) textarea.disabled = false;
                    const pauseBtn = document.getElementById('batch-pause');
                    if (pauseBtn) pauseBtn.style.display = 'none';
                }
            }
        }

        async copyTasksByStatus(status) {
            let tasksToCopy;
            let message;
            switch (status) {
                case 'all':
                    tasksToCopy = this.tasks;
                    message = '全部';
                    break;
                case 'success':
                    tasksToCopy = this.tasks.filter(t => t.status === 'success');
                    message = '成功';
                    break;
                case 'error':
                    tasksToCopy = this.tasks.filter(t => t.status === 'error');
                    message = '失败';
                    break;
                default:
                    return;
            }
            if (tasksToCopy.length === 0) {
                this.showToast(`没有${message}的任务`);
                return;
            }
            const urls = tasksToCopy.map(t => t.url).join('\n');
            try {
                await navigator.clipboard.writeText(urls);
                this.showToast(`已复制 ${tasksToCopy.length} 个${message}任务链接`);
            } catch (err) {
                const textarea = document.querySelector('.batch-textarea');
                if (textarea) {
                    textarea.value = urls;
                    this.showToast(`已复制 ${tasksToCopy.length} 个${message}任务到输入框`);
                }
            }
        }

        delay(ms) {
            if (ms <= 0) return Promise.resolve();
            
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        showWindow() {
            if (this.container) {
                this.container.style.display = 'block';
            }
        }

        injectMenu() {
            const checkAndInject = () => {
                const toolMenu = document.querySelector('li[data-menu-id="rc-menu-uuid-/Tools"]');
                if (toolMenu) {
                    const parentUl = toolMenu.parentElement;
                    if (parentUl && !document.getElementById('batch-menu-item')) {
                        const batchMenuItem = document.createElement('li');
                        batchMenuItem.id = 'batch-menu-item';
                        batchMenuItem.className = 'ant-menu-item ant-menu-item-only-child';
                        batchMenuItem.setAttribute('role', 'menuitem');
                        batchMenuItem.setAttribute('data-menu-id', 'rc-menu-uuid-/batch-offline');
                        batchMenuItem.style.paddingLeft = '24px';
                        batchMenuItem.innerHTML = `
                            <span class="ant-menu-title-content">
                                <div class="menu-item">
                                    <div class="menu-icon-wrapper">
                                        <svg class="icon menu-icon" aria-hidden="true">
                                            <use xlink:href="#general_download_16_1"></use>
                                        </svg>
                                    </div>
                                    <div class="menu-text">批量离线</div>
                                </div>
                            </span>
                        `;
                        batchMenuItem.onclick = () => {
                            this.showWindow();
                        };
                        parentUl.insertBefore(batchMenuItem, toolMenu);
                    }
                } else {
                    setTimeout(checkAndInject, 500);
                }
            };
            checkAndInject();
        }

        showToast(message, duration = 3000) {
            const toast = document.createElement('div');
            let toastClass = 'batch-toast';
            let toastIcon = '';

            if (message.includes('成功') || message.includes('完成') || message.includes('设置')) {
                toastClass += ' batch-toast-success';
                toastIcon = icon('check');
            } else if (message.includes('失败') || message.includes('错误') || message.includes('无法') || message.includes('没有')) {
                toastClass += ' batch-toast-error';
                toastIcon = icon('x');
            } else if (message.includes('重试') || message.includes('等待') || message.includes('开始任务')) {
                toastClass += ' batch-toast-warning';
                toastIcon = icon('clock');
            } else if (message.includes('Token')) {
                toastIcon = icon('key');
            } else if (message.includes('粘贴') || message.includes('复制')) {
                toastIcon = icon('list');
            }

            toast.className = toastClass;
            toast.innerHTML = toastIcon + message;
            document.body.appendChild(toast);

            setTimeout(() => {
                toast.remove();
            }, duration);
        }
    }

    // ================== 初始化 ==================
    const initDownloader = () => {
        window.downloader = new BatchDownloader();
        window.downloader.injectMenu();
    };

    if (window.location.hostname.includes('123pan.com')) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => setTimeout(initDownloader, 1500));
        } else {
            setTimeout(initDownloader, 1500);
        }
    }
})();