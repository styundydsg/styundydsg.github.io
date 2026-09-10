const app = Vue.createApp({
    mixins: Object.values(mixins),
    data() {
        return {
            loading: true,
            hiddenMenu: false,
            showMenuItems: false,
            menuColor: false,
            scrollTop: 0,
            renderers: [],
        };
    },
    created() {
        const hideLoading = () => {
            this.loading = false;
        };
        // 首屏遮罩只等 DOM 解析完成，不必等到所有图片/子资源加载完，
        // 之后的各区块由 progressive.js 逐段浮现。
        if (document.readyState === "complete" || document.readyState === "interactive") {
            hideLoading();
        } else {
            document.addEventListener("DOMContentLoaded", hideLoading);
        }
    },
    mounted() {
        window.addEventListener("scroll", this.handleScroll, true);
        this.render();
        this.initTagExpand();
        this.initSearch();
        // 确保DOM完全加载后再初始化QA功能
        if (document.readyState === 'complete') {
            this.initQA();
        } else {
            window.addEventListener('load', () => {
                this.initQA();
            });
        }
    },
    methods: {
        render() {
            for (let i of this.renderers) i();
        },
        handleScroll() {
            let wrap = this.$refs.homePostsWrap;
            let newScrollTop = document.documentElement.scrollTop;
            if (this.scrollTop < newScrollTop) {
                this.hiddenMenu = true;
                this.showMenuItems = false;
            } else this.hiddenMenu = false;
            if (wrap) {
                if (newScrollTop <= window.innerHeight - 100) this.menuColor = true;
                else this.menuColor = false;
                if (newScrollTop <= 400) wrap.style.top = "-" + newScrollTop / 5 + "px";
                else wrap.style.top = "-80px";
            }
            this.scrollTop = newScrollTop;
        },
        initTagExpand() {
            // 标签汇总页：点击标签展开对应文章，支持 ?tag=xxx 自动展开
            const postsBox = document.getElementById("tag-posts");
            if (!postsBox) return; // 仅标签汇总页 (/tags/)
            const chips = Array.from(document.querySelectorAll(".tag-chip"));
            const groups = Array.from(document.querySelectorAll(".tag-posts-group"));
            const empty = document.getElementById("tag-posts-empty");
            if (!groups.length) return;
            const byTag = {};
            groups.forEach((g) => (byTag[g.dataset.tagGroup] = g));

            const updateUrl = (name) => {
                const url = new URL(location.href);
                if (name && byTag[name]) url.searchParams.set("tag", name);
                else url.searchParams.delete("tag");
                history.replaceState(null, "", url.pathname + url.search);
            };

            const showGroup = (name, scroll) => {
                chips.forEach((c) => c.classList.toggle("active", c.dataset.tag === name));
                groups.forEach((g) => {
                    g.hidden = g.dataset.tagGroup !== name;
                });
                if (empty) empty.style.display = byTag[name] ? "none" : "block";
                updateUrl(name);
                if (scroll && byTag[name]) {
                    setTimeout(() => {
                        byTag[name].scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 120);
                }
            };

            // 初始：URL 参数自动展开（如从首页点击标签跳转而来）
            const initTag = new URLSearchParams(location.search).get("tag");
            if (initTag && byTag[initTag]) showGroup(initTag, true);

            chips.forEach((c) => {
                c.addEventListener("click", (e) => {
                    e.preventDefault();
                    const name = c.dataset.tag;
                    if (c.classList.contains("active")) {
                        // 再次点击当前标签：收起
                        chips.forEach((x) => x.classList.remove("active"));
                        groups.forEach((g) => {
                            g.hidden = true;
                        });
                        if (empty) empty.style.display = "block";
                        updateUrl("");
                    } else {
                        showGroup(name, true);
                    }
                });
            });
        },
        initSearch() {
            // 全局搜索：点击菜单放大镜弹出搜索窗口，按标题过滤全站文章
            // 搜索窗口 DOM 位于 body 末尾，需等 DOM 解析完再绑定事件
            const init = () => {
                const overlay = document.getElementById("search-overlay");
                const input = document.getElementById("search-input");
                const results = document.getElementById("search-results");
                const closeBtn = document.getElementById("search-close");
                const openBtn = document.getElementById("search-open");
                const openBtnMobile = document.getElementById("search-open-mobile");
                if (!overlay || !input || !results) return;
                const data = window.__SEARCH_DATA__ || [];

                const escapeHtml = (s) =>
                    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

                const render = (q) => {
                    const kw = q.trim().toLowerCase().replace(/\s+/g, "");
                    if (!kw) {
                        results.innerHTML = '<div class="search-hint">输入关键词，按标题搜索文章</div>';
                        return;
                    }
                    // 文章按标题匹配；随记额外匹配正文（随记常以正文首句命名）
                    const hits = data.filter((p) => {
                        const title = (p.title || "").toLowerCase().replace(/\s+/g, "");
                        if (title.includes(kw)) return true;
                        if (!p.note || !p.text) return false;
                        return p.text.toLowerCase().replace(/\s+/g, "").includes(kw);
                    });
                    if (!hits.length) {
                        results.innerHTML = '<div class="search-empty">没有找到相关文章</div>';
                        return;
                    }
                    results.innerHTML = hits
                        .map((p) => {
                            // 随记没有独立页面：不跳转，点击后在侧栏随记卡片里展开
                            if (p.note) {
                                return (
                                    `<a class="search-item search-item-note" data-note-id="${p.noteId}">` +
                                    `<span class="search-item-title">` +
                                    `<i class="fa-solid fa-note-sticky fa-fw"></i>` +
                                    `${escapeHtml(p.title)}</span>` +
                                    `<span class="search-item-date">${escapeHtml(p.date)}</span>` +
                                    `</a>`
                                );
                            }
                            return (
                                `<a class="search-item" href="${p.path}">` +
                                `<span class="search-item-title">${escapeHtml(p.title)}</span>` +
                                `<span class="search-item-date">${escapeHtml(p.date)}</span>` +
                                `</a>`
                            );
                        })
                        .join("");
                };

                const open = () => {
                    overlay.hidden = false;
                    render("");
                    setTimeout(() => input.focus(), 60);
                };
                const close = () => {
                    overlay.hidden = true;
                    input.value = "";
                    results.innerHTML = "";
                };

                if (openBtn) openBtn.addEventListener("click", open);
                if (openBtnMobile) openBtnMobile.addEventListener("click", open);
                if (closeBtn) closeBtn.addEventListener("click", close);
                input.addEventListener("input", () => render(input.value));
                // 点击随记结果：随记没有独立页面，统一回到首页侧栏随记卡片里展开。
                // 在首页时直接展开；在其它页面（文章页 / 归档 / 标签等）先把 noteId
                // 记在 URL hash 上再跳回首页，由随记运行时读取并自动展开。
                results.addEventListener("click", (e) => {
                    const item = e.target.closest && e.target.closest(".search-item-note");
                    if (!item) return;
                    e.preventDefault();
                    const id = parseInt(item.dataset.noteId, 10);
                    close();
                    const notes = window.__NOTES__;
                    if (notes && typeof notes.open === "function" && notes.hasCard) {
                        notes.open(id);
                    } else {
                        // 当前页没有随记卡片，跳回首页并带上要展开的条目
                        location.href = "/#note-" + id;
                    }
                });
                overlay.addEventListener("click", (e) => {
                    if (e.target === overlay) close();
                });
                document.addEventListener("keydown", (e) => {
                    if (e.key === "Escape") close();
                });
            };
            if (document.readyState === "complete" || document.readyState === "interactive") {
                init();
            } else {
                document.addEventListener("DOMContentLoaded", init);
            }
        },
        initQA() {
            // 初始化问答功能
            const qaButton = document.getElementById('qa-button');
            const qaWindow = document.getElementById('qa-window');
            const qaClose = document.getElementById('qa-close');
            const qaSubmit = document.getElementById('qa-submit');
            const qaQuestion = document.getElementById('qa-question');
            const qaResults = document.getElementById('qa-results');

            console.log('QA elements found:', {qaButton, qaWindow, qaClose, qaSubmit, qaQuestion, qaResults});

            // 检查所有必要的元素是否存在
            if (!qaButton || !qaWindow || !qaClose || !qaSubmit || !qaQuestion || !qaResults) {
                console.error('QA功能初始化失败：缺少必要的HTML元素');
                return;
            }

            // 切换问答窗口显示
            qaButton.addEventListener('click', () => {
                console.log('QA button clicked');
                qaWindow.classList.toggle('show');
                console.log('Window show class toggled:', qaWindow.classList.contains('show'));
            });

            // 关闭问答窗口
            qaClose.addEventListener('click', () => {
                qaWindow.classList.remove('show');
            });

            // 提交问题
            qaSubmit.addEventListener('click', () => {
                this.askRAG(qaQuestion, qaResults);
            });

            // 按回车键提交问题
            qaQuestion.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.askRAG(qaQuestion, qaResults);
                }
            });

            // 点击窗口外部关闭问答窗口
            document.addEventListener('click', (e) => {
                if (qaWindow.classList.contains('show') && 
                    !qaWindow.contains(e.target) && 
                    !qaButton.contains(e.target)) {
                    qaWindow.classList.remove('show');
                }
            });

            console.log('QA功能初始化成功');
        },
        async askRAG(inputElement, resultsContainer) {
            const question = inputElement.value.trim();
            if (!question) return;

            // 添加用户问题到结果区域
            this.addResult(resultsContainer, question, 'user');

            // 清空输入框
            inputElement.value = '';

            // 显示加载状态
            const loadingItem = document.createElement('div');
            loadingItem.className = 'qa-result-item loading';
            loadingItem.innerHTML = '<div class="spinner">Thinking... ⏳</div>';
            resultsContainer.appendChild(loadingItem);
            resultsContainer.scrollTop = resultsContainer.scrollHeight;

            try {
                const response = await fetch('http://127.0.0.1:8000/ask', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({question})
                });
                
                const data = await response.json();
                
                // 移除加载状态
                resultsContainer.removeChild(loadingItem);
                
                // 添加AI回答
                this.addResult(resultsContainer, data.answer, 'ai');

                if (data.answer == "blogger_online") {
                    // 添加联系博主按钮
                    this.addContactBloggerButton(resultsContainer);
                }
                
            } catch (error) {
                // 移除加载状态
                resultsContainer.removeChild(loadingItem);
                
                // 添加错误信息
                const errorItem = document.createElement('div');
                errorItem.className = 'qa-result-item error';
                errorItem.innerHTML = `<strong>Error:</strong> ${error.message}`;
                resultsContainer.appendChild(errorItem);
            }
            
            // 滚动到底部
            resultsContainer.scrollTop = resultsContainer.scrollHeight;
        },
        addResult(container, text, type) {
            const resultItem = document.createElement('div');
            resultItem.className = `qa-result-item ${type}`;
            
            // 创建标题元素
            const strong = document.createElement('strong');
            if (type === 'user') {
                strong.textContent = '您: ';
                resultItem.style.borderLeftColor = '#66afef';
            } else {
                strong.textContent = 'AI: ';
                resultItem.style.borderLeftColor = '#34d058';
            }
            
            // 创建文本内容（保留换行符）
            const textNode = document.createTextNode(text);
            
            // 将标题和文本内容添加到结果项
            resultItem.appendChild(strong);
            resultItem.appendChild(textNode);
            
            container.appendChild(resultItem);
            
            // 滚动到底部
            container.scrollTop = container.scrollHeight;
        },
        
        addContactBloggerButton(container) {
            // 创建联系博主按钮容器
            const contactContainer = document.createElement('div');
            contactContainer.className = 'qa-contact-blogger';
            contactContainer.style.marginTop = '15px';
            contactContainer.style.padding = '10px';
            contactContainer.style.backgroundColor = '#f8f9fa';
            contactContainer.style.borderRadius = '8px';
            contactContainer.style.borderLeft = '4px solid #ff6b6b';
            
            // 创建提示文本
            const promptText = document.createElement('p');
            promptText.textContent = '博主当前在线，您可以联系博主进行实时交流：';
            promptText.style.margin = '0 0 10px 0';
            promptText.style.fontSize = '14px';
            promptText.style.color = '#666';
            
            // 创建联系按钮
            const contactButton = document.createElement('button');
            contactButton.textContent = '联系博主';
            contactButton.className = 'qa-contact-button';
            contactButton.style.padding = '8px 16px';
            contactButton.style.backgroundColor = '#ff6b6b';
            contactButton.style.color = 'white';
            contactButton.style.border = 'none';
            contactButton.style.borderRadius = '4px';
            contactButton.style.cursor = 'pointer';
            contactButton.style.fontSize = '14px';
            contactButton.style.transition = 'background-color 0.3s';
            
            // 添加悬停效果
            contactButton.addEventListener('mouseenter', () => {
                contactButton.style.backgroundColor = '#ff5252';
            });
            contactButton.addEventListener('mouseleave', () => {
                contactButton.style.backgroundColor = '#ff6b6b';
            });
            
            // 添加点击事件 - 调用联系博主API
            contactButton.addEventListener('click', () => {
                this.contactBlogger();
            });
            
            // 组装元素
            contactContainer.appendChild(promptText);
            contactContainer.appendChild(contactButton);
            container.appendChild(contactContainer);
            
            // 滚动到底部
            container.scrollTop = container.scrollHeight;
        },
        
        async contactBlogger() {
            try {
                // 建立WebSocket连接（TCP-like连接）
                const ws = new WebSocket('ws://127.0.0.1:8000/contact');
                
                ws.onopen = () => {
                    console.log('WebSocket连接已建立');
                    
                    // 发送连接请求
                    ws.send(JSON.stringify({
                        type: 'contact_request',
                        message: '用户请求联系博主',
                        timestamp: new Date().toISOString(),
                        userAgent: navigator.userAgent
                    }));
                    
                    // 显示连接状态
                    this.showChatInterface(ws);
                };
                
                ws.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    console.log('收到消息:', data);
                    
                    if (data.type === 'connection_established') {
                        alert('连接已建立！现在可以与博主实时交流了。');
                    } else if (data.type === 'message') {
                        this.displayMessage(data.message, 'blogger');
                    }
                };
                
                ws.onerror = (error) => {
                    console.error('WebSocket错误:', error);
                    alert('连接失败，请检查网络连接或稍后重试。');
                };
                
                ws.onclose = () => {
                    console.log('WebSocket连接已关闭');
                    alert('连接已断开。');
                };
                
            } catch (error) {
                console.error('建立连接失败:', error);
                alert('无法建立连接，请确保TCP服务器正在运行。');
            }
        },
        
        showChatInterface(ws) {
            // 创建聊天界面
            const chatContainer = document.createElement('div');
            chatContainer.className = 'qa-chat-interface';
            chatContainer.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 400px;
                height: 500px;
                background: white;
                border-radius: 15px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
                z-index: 1002;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            `;
            
            // 聊天头部
            const chatHeader = document.createElement('div');
            chatHeader.style.cssText = `
                background: linear-gradient(120deg, #ff6b6b 0%, #ff5252 100%);
                color: white;
                padding: 15px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            `;
            chatHeader.innerHTML = `
                <h3 style="margin: 0; font-size: 16px;">与博主实时交流</h3>
                <button id="chat-close" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer;">&times;</button>
            `;
            
            // 聊天消息区域
            const chatMessages = document.createElement('div');
            chatMessages.className = 'chat-messages';
            chatMessages.style.cssText = `
                flex: 1;
                padding: 15px;
                overflow-y: auto;
                background: #f9f9f9;
            `;
            
            // 聊天输入区域
            const chatInput = document.createElement('div');
            chatInput.style.cssText = `
                display: flex;
                padding: 15px;
                border-top: 1px solid #eee;
                background: white;
            `;
            chatInput.innerHTML = `
                <input type="text" id="chat-input" placeholder="输入消息..." style="flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 20px; outline: none;">
                <button id="chat-send" style="margin-left: 10px; padding: 10px 20px; background: #ff6b6b; color: white; border: none; border-radius: 20px; cursor: pointer;">发送</button>
            `;
            
            // 组装聊天界面
            chatContainer.appendChild(chatHeader);
            chatContainer.appendChild(chatMessages);
            chatContainer.appendChild(chatInput);
            document.body.appendChild(chatContainer);
            
            // 关闭按钮事件
            document.getElementById('chat-close').addEventListener('click', () => {
                ws.close();
                document.body.removeChild(chatContainer);
            });
            
            // 发送消息事件
            document.getElementById('chat-send').addEventListener('click', () => {
                this.sendMessage(ws);
            });
            
            // 回车发送消息
            document.getElementById('chat-input').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage(ws);
                }
            });
            
            // 点击外部关闭
            document.addEventListener('click', (e) => {
                if (e.target === chatContainer) {
                    ws.close();
                    document.body.removeChild(chatContainer);
                }
            });
        },
        
        sendMessage(ws) {
            const input = document.getElementById('chat-input');
            const message = input.value.trim();
            
            if (message && ws.readyState === WebSocket.OPEN) {
                // 发送消息
                ws.send(JSON.stringify({
                    type: 'message',
                    message: message,
                    timestamp: new Date().toISOString()
                }));
                
                // 显示用户消息
                this.displayMessage(message, 'user');
                
                // 清空输入框
                input.value = '';
            }
        },
        
        displayMessage(message, sender) {
            const chatMessages = document.querySelector('.chat-messages');
            if (!chatMessages) return;
            
            const messageDiv = document.createElement('div');
            messageDiv.style.cssText = `
                margin-bottom: 10px;
                padding: 10px 15px;
                border-radius: 15px;
                max-width: 80%;
                word-wrap: break-word;
                ${sender === 'user' ? 
                    'background: #66afef; color: white; align-self: flex-end; margin-left: auto;' : 
                    'background: #f0f0f0; color: #333; align-self: flex-start;'}
            `;
            messageDiv.textContent = message;
            
            chatMessages.appendChild(messageDiv);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    },
});
app.mount("#layout");
