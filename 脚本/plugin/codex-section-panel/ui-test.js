"use strict";

// Runs the real panel rendering code and CSS in Chromium; only Obsidian's DOM helpers are adapted.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
let playwright;
try { playwright = require("playwright"); } catch {
  playwright = require("C:/Users/12032/AppData/Local/OpenAI/Codex/runtimes/cua_node/cfb32733c877621e/bin/node_modules/playwright");
}

async function run() {
  const browser = await playwright.chromium.launch({ channel: "msedge", headless: true });
  try {
    const verificationDir = path.join(
      "C:\\Users\\12032\\.codex\\visualizations\\2026\\10\\13\\01a132d7-6b13-7113-b7b0-a8746780a4b0",
      `codex-panel-stage-ui-${Date.now()}-${process.pid}`,
    );
    fs.mkdirSync(verificationDir, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1000, height: 720 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setContent(`<style>
      :root { --background-primary:#fff; --background-primary-alt:#fafafa; --background-secondary:#f5f5f5;
      --background-modifier-border:#ddd; --background-modifier-hover:#f0edff; --interactive-accent:#8b5cf6;
      --text-normal:#222; --text-muted:#777; --text-error:#c33;
      --font-ui-small:14px; --font-small:12px; --font-monospace:monospace; --font-text:sans-serif;
      --size-4-1:4px; --size-4-2:8px; --radius-m:8px; --radius-s:4px; --line-height-normal:1.5; }
      body { margin:0; font-family:sans-serif; }
      .host { position:absolute; inset:50px 30px 30px 230px; transform:translateX(18px) scale(.95); transform-origin:top left; }
      .codex-section-panel { height:100%; } .codex-section-panel__layout { height:100%; }
    </style><div class="host codex-section-panel-view"><div class="view-content codex-section-panel">
      <div class="codex-section-panel__layout"><aside></aside><div class="codex-section-panel__chat">
      <div class="codex-section-panel__messages"></div></div></div></div></div>`);
    await page.addStyleTag({ content: fs.readFileSync(path.join(__dirname, "styles.css"), "utf8") });
    await page.addScriptTag({ content: `
      Element.prototype.createEl=function(tag,opts={}){const el=this.ownerDocument.createElement(tag);
      if(opts.cls)el.className=opts.cls;if(opts.text!==undefined)el.textContent=opts.text;
      for(const [k,v] of Object.entries(opts.attr||{}))el.setAttribute(k,v);this.appendChild(el);return el;};
      Element.prototype.createDiv=function(o={}){return this.createEl('div',typeof o==='string'?{cls:o}:o)};
      Element.prototype.empty=function(){this.replaceChildren()};
      Element.prototype.addClass=function(x){this.classList.add(x)};
      Element.prototype.removeClass=function(x){this.classList.remove(x)};
      Element.prototype.setText=function(x){this.textContent=x};
      const renderMarkdownForTest=async(markdown,el,api)=>{
        el.dataset.markdownRendered='true';el.dataset.markdownApi=api;
        for(const block of String(markdown).split(String.fromCharCode(10)+String.fromCharCode(10)).filter(Boolean)){
          const heading=block.match(/^(#+) (.+)$/);
          const node=el.ownerDocument.createElement(heading?'h'+heading[1].length:'p');
          const text=heading?heading[2]:block;
          text.split('**').forEach((part,index)=>{
            if(index%2){const strong=el.ownerDocument.createElement('strong');strong.textContent=part;node.append(strong)}
            else node.append(el.ownerDocument.createTextNode(part));
          });
          el.append(node);
        }
      };
      window.require=id=>{
        if(id==='obsidian')return {ItemView:class{},MarkdownView:class{},MarkdownRenderer:{
          render:async(app,markdown,el)=>renderMarkdownForTest(markdown,el,'render'),
          renderMarkdown:async(markdown,el)=>renderMarkdownForTest(markdown,el,'renderMarkdown'),
        },Modal:class{constructor(app){this.app=app;this.container=document.createElement('div');this.container.style.cssText='position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:rgba(0,0,0,.25)';this.contentEl=document.createElement('div');this.contentEl.className='modal-content';this.container.append(this.contentEl)}open(){document.body.append(this.container)}close(){this.container.remove()}},Notice:class{},Plugin:class{},PluginSettingTab:class{},Setting:class{},setIcon:(el,name)=>{const svg=el.ownerDocument.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('data-icon',name);svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');const paths={'message-square':'M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z','chevron-left':'m15 18-6-6 6-6','chevron-right':'m9 18 6-6-6-6','trash-2':'M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14','copy':'M8 8h12v13H8zM4 16V3h12','rotate-ccw':'M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5','send':'m22 2-7 20-4-9-9-4zM22 2 11 13','pause':'M7 4h3v16H7zM14 4h3v16h-3z'};svg.innerHTML='<path d="'+(paths[name]||'')+'"/>';el.replaceChildren(svg)}};
        if(id==='url')return {URL:window.URL};return {};
      };
      window.module={exports:{}};
    ` });
    await page.addScriptTag({ content: fs.readFileSync(path.join(__dirname, "main.js"), "utf8") + "\nwindow.PanelView=CodexSectionPanelView;" });
    await page.evaluate(() => {
      window.conversation = { messages: [] };
      window.panel = new window.PanelView(null, { getActiveConversation: () => window.conversation });
      const layout=document.querySelector(".codex-section-panel__layout");
      const history=document.createElement("aside");history.className="codex-section-panel__history";
      const header=document.createElement("div");header.className="codex-section-panel__history-header";
      const heading=document.createElement("h3");heading.textContent="历史对话";header.append(heading);
      const toggle=document.createElement("button");toggle.className="codex-section-panel__history-toggle";header.append(toggle);
      history.append(header);
      const list=document.createElement("div");list.className="codex-section-panel__history-list";history.append(list);
      layout.prepend(history);
      const timestamp=new Date();
      window.historyConversation={id:"history-one",title:"请整理和比较这两个章节并给出结论",updatedAt:timestamp.getTime(),messages:[
        {role:"user",references:[{heading:"## 内存管理与垃圾回收",marker:"[[agent/agent]] L741-L1054"}]}
      ]};
      window.panel.plugin={getActiveConversation:()=>window.conversation,chatState:{activeConversationId:"history-one",historyCollapsed:false,conversations:[window.historyConversation]},persistChatState:async()=>{}};
      window.panel.historyLayoutEl=layout;window.panel.historyToggleButton=toggle;window.panel.historyListEl=list;
      toggle.addEventListener("click",()=>void window.panel.toggleHistorySidebar());
      window.panel.renderHistorySidebarState();window.panel.renderHistory();
      window.panel.messagesEl = document.querySelector(".codex-section-panel__messages");
      window.panel.renderMessage({ role: "user", content: "整理这两个章节", references: [
        { marker: "[[agent/agent]] (L741:C1-L1054:C1)", text: "## 内存管理\n引用内容。".repeat(30) },
        { marker: "[[agent/agent]] (L1054:C1-L1187:C1)", text: "## 垃圾回收机制\n循环引用示例。".repeat(30) },
      ], createdAt: timestamp.getTime() });
    });
    const firstUserBubble = page.locator(".codex-section-panel__message--user").last();
    assert.match(await firstUserBubble.locator(".codex-section-panel__message-time").innerText(), /^\d{2}:\d{2}:\d{2}$/,
      "each chat bubble shows its creation time");
    assert.equal(await firstUserBubble.locator(".codex-section-panel__message-copy svg").getAttribute("data-icon"), "copy",
      "message copy uses the shared copy icon");
    assert.equal(await page.locator(".codex-section-panel__history-item").count(),1);
    assert.match(await page.locator(".codex-section-panel__history-item").innerText(),/内存管理与垃圾回收/);
    assert.match(await page.locator(".codex-section-panel__history-item").innerText(),/今天/);
    assert.equal(await page.locator(".codex-section-panel__history-icon svg").getAttribute("data-icon"),"message-square");
    assert.equal(await page.locator(".codex-section-panel__copy-conversation").count(),0,"history list matches the compact design without a redundant whole-chat button");
    await page.locator(".codex-section-panel__history-toggle").click();
    assert.equal(await page.locator(".codex-section-panel__layout").evaluate(el=>el.classList.contains("is-history-collapsed")),true);
    assert.equal(await page.locator(".codex-section-panel__history-toggle").getAttribute("aria-expanded"),"false");
    assert.equal(await page.evaluate(()=>window.panel.plugin.chatState.historyCollapsed),true,"the collapsed state is stored with chat history");
    await page.locator(".codex-section-panel__history-toggle").click();
    await page.screenshot({ path: path.join(verificationDir, "history-style.png") });
    const button = page.locator(".codex-section-panel__reference-button");
    await button.hover();
    const preview = page.locator(".codex-section-panel__reference-preview");
    await preview.waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      const el = document.querySelector(".codex-section-panel__reference-preview");
      return el && parseFloat(el.style.top) > 0;
    });
    const geometry = await page.evaluate(() => {
      const anchor=document.querySelector(".codex-section-panel__reference-button").getBoundingClientRect();
      const overlay=document.querySelector(".codex-section-panel__reference-preview");
      const rect=overlay.getBoundingClientRect();
      return { portal:overlay.parentElement===document.body, left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,
        gap:Math.min(Math.abs(rect.bottom-anchor.top),Math.abs(rect.top-anchor.bottom)) };
    });
    assert.equal(geometry.portal, true, "preview must escape transformed and clipped message ancestors");
    assert.ok(geometry.gap <= 12, "preview stays adjacent to its paperclip");
    assert.ok(geometry.left>=7 && geometry.right<=993 && geometry.top>=7 && geometry.bottom<=713, "preview stays inside viewport");
    await preview.hover();
    await page.waitForTimeout(250);
    assert.equal(await preview.isVisible(), true, "moving the pointer onto the preview must not close it");
    await page.screenshot({ path: path.join(verificationDir, "hover-wide.png") });
    await page.setViewportSize({ width:800, height:620 });
    await page.waitForTimeout(100);
    const resized=await preview.boundingBox();
    assert.ok(resized.x>=7 && resized.x+resized.width<=793 && resized.y>=7 && resized.y+resized.height<=613,`open preview follows window resizing: ${JSON.stringify(resized)}`);
    await page.setViewportSize({ width:1000, height:720 });
    await page.evaluate(()=>{
      const messages=window.panel.messagesEl;
      const spacer=document.createElement("div");spacer.style.cssText="height:150px;flex-shrink:0";
      messages.prepend(spacer);
      const tail=document.createElement("div");tail.style.cssText="height:900px;flex-shrink:0";messages.append(tail);
      messages.scrollTop=40;
    });
    await page.waitForTimeout(100);
    const scrolled=await page.evaluate(()=>{
      const anchor=document.querySelector(".codex-section-panel__reference-button").getBoundingClientRect();
      const rect=document.querySelector(".codex-section-panel__reference-preview").getBoundingClientRect();
      return Math.min(Math.abs(rect.bottom-anchor.top),Math.abs(rect.top-anchor.bottom));
    });
    assert.ok(scrolled<=12,"open preview reanchors when the chat scrolls");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".codex-section-panel__reference-preview.is-open"));
    await page.evaluate(() => {
      const plugin=new window.module.exports();
      plugin.app={};
      plugin.chatState=CodexSectionPanelTestAPI.normalizeChatState({activeConversationId:"history-one",conversations:[
        {id:"history-one",title:"当前对话",updatedAt:200,messages:[{role:"user",content:"当前消息"}]},
        {id:"history-two",title:"较早对话",updatedAt:100,messages:[{role:"user",content:"较早消息"}]},
      ]});
      plugin.persistChatState=async()=>{window.persistedDeleteState=JSON.stringify(plugin.chatState)};
      window.panel.plugin=plugin;
      window.panel.renderHistory();
    });
    assert.equal(await page.locator(".codex-section-panel__history-item").count(),2);
    const inactiveRow=page.locator(".codex-section-panel__history-item").filter({hasText:"较早对话"});
    await inactiveRow.hover();
    await page.waitForFunction(()=>{const row=Array.from(document.querySelectorAll(".codex-section-panel__history-item")).find(el=>el.innerText.includes("较早对话"));return row&&getComputedStyle(row.querySelector(".codex-section-panel__history-delete")).opacity==="1"});
    assert.equal(await inactiveRow.locator(".codex-section-panel__history-delete").evaluate(el=>getComputedStyle(el).opacity),"1","history delete control becomes visible on hover");
    await inactiveRow.locator(".codex-section-panel__history-delete").click();
    assert.match(await page.locator(".codex-section-panel__delete-confirm").innerText(),/从本地删除/);
    await page.locator(".codex-section-panel__delete-cancel").click();
    assert.equal(await page.locator(".codex-section-panel__history-item").count(),2,"cancel leaves the selected history intact");
    await page.locator(".codex-section-panel__history-item").filter({hasText:"较早对话"}).locator(".codex-section-panel__history-delete").click();
    await page.locator(".codex-section-panel__delete-confirm-button").click();
    assert.equal(await page.locator(".codex-section-panel__history-item").count(),1,"confirm removes only the targeted local history record");
    assert.equal(await page.evaluate(()=>window.panel.plugin.chatState.activeConversationId),"history-one","deleting another conversation does not switch the active chat");
    await page.locator(".codex-section-panel__history-delete").click();
    assert.match(await page.locator(".codex-section-panel__delete-confirm").innerText(),/新建空白对话/);
    await page.locator(".codex-section-panel__delete-confirm-button").click();
    const afterLastDelete=await page.evaluate(()=>({state:window.panel.plugin.chatState,rendered:document.querySelector(".codex-section-panel__history-list").innerText,persisted:window.persistedDeleteState}));
    assert.equal(afterLastDelete.state.conversations.length,1,"deleting the final conversation creates a replacement blank record");
    assert.equal(afterLastDelete.state.conversations[0].messages.length,0);
    assert.equal(afterLastDelete.state.activeConversationId,afterLastDelete.state.conversations[0].id);
    assert.match(afterLastDelete.rendered,/新对话/);
    assert.ok(afterLastDelete.persisted,"history deletion is persisted");

    // Exercise the entire send -> requestCodex subscription -> rendered timeline -> persisted answer path.
    await page.evaluate(async () => {
      const panel=window.panel;
      const conversation=window.conversation;
      conversation.id="ui-chat";conversation.messages=[];conversation.model="";
      const plugin=new window.module.exports();
      plugin.getActiveConversation=()=>window.conversation;
      window.sourceViewReads=0;
      plugin.getSourceMarkdownView=()=>{window.sourceViewReads++;return null};
      plugin.persistChatState=async()=>{};
      plugin.ensureConversationThread=async()=>({threadId:"ui-thread",resumed:true});
      let subscriber;
      plugin.appServer={subscribe:cb=>{subscriber=cb;return()=>{subscriber=null}},startTurn:async()=>({turn:{id:"ui-turn"}})};
      panel.plugin=plugin;
      panel.renderContexts=()=>{};panel.renderHistory=()=>{};panel.renderEditPreview=()=>{};
      panel.promptInput={value:"读取内容"};panel.contexts=[
        {path:"note.md",marker:"[[note]] (L1:C1-L2:C1)",rangeLabel:"L1:C1-L2:C1",text:"## 引用正文\n用于重试验证"},
        {path:"second.md",marker:"[[second]] (L5:C1-L6:C1)",rangeLabel:"L5:C1-L6:C1",text:"## 第二条引用\n用于范围验证"},
      ];
      panel.modelSelect={value:"gpt-6.1-sol"};
      const pending=panel.send();
      await new Promise(resolve=>setTimeout(resolve,0));
      window.finishUiTurn=()=>subscriber({method:"turn/completed",params:{threadId:"ui-thread",turn:{id:"ui-turn",status:"completed"}}});
      window.pendingUiTurn=pending;
      const emit=(method,item)=>subscriber({method,params:{threadId:"ui-thread",turnId:"ui-turn",item}});
      emit("item/started",{id:"reason-ui",type:"reasoning"});
      emit("item/completed",{id:"reason-ui",type:"reasoning"});
      emit("item/started",{id:"web-ui",type:"webSearch",action:{type:"search",query:"CPython garbage collection"}});
      emit("item/completed",{id:"web-ui",type:"webSearch",action:{type:"search",query:"CPython garbage collection"}});
      emit("item/started",{id:"comment-ui",type:"agentMessage",phase:"commentary"});
      subscriber({method:"item/agentMessage/delta",params:{threadId:"ui-thread",turnId:"ui-turn",itemId:"comment-ui",delta:"正在核对引用章节。"}});
      emit("item/started",{id:"cmd-ui",type:"commandExecution",command:"Get-Content agent.md",status:"inProgress"});
      window.completeCommand=()=>{emit("item/completed",{id:"cmd-ui",type:"commandExecution",status:"completed",exitCode:0,aggregatedOutput:"读取到 3 个对象\\n"+"完整诊断输出。".repeat(100)});
        subscriber({method:"item/agentMessage/delta",params:{threadId:"ui-thread",turnId:"ui-turn",itemId:"answer-ui",delta:"内容已读取。"}})};
    });
    assert.equal(await page.evaluate(()=>window.sourceViewReads),0,"free-form questions must not silently attach the editor's current section");
    assert.match(await page.locator(".codex-section-panel__message--codex").innerText(), /检索资料/);
    assert.match(await page.locator(".codex-section-panel__message--codex").innerText(), /正在核对引用章节/);
    assert.match(await page.locator(".codex-section-panel__message--codex").innerText(), /Get-Content agent.md/);
    await page.screenshot({ path: path.join(verificationDir, "actions-running.png") });
    await page.evaluate(async()=>{window.completeCommand();window.finishUiTurn();await window.pendingUiTurn;});
    assert.equal(await page.locator(".codex-section-panel__work").count(), 1);
    assert.equal(await page.locator(".codex-section-panel__work").evaluate(el=>el.open),true,"completed phase details should remain expanded by default");
    assert.match(await page.locator(".codex-section-panel__work-summary").innerText(), /累计耗时 .*秒/,
      "the phase summary includes summed completed action time");
    assert.equal(await page.locator(".codex-section-panel__work-copy-all svg").getAttribute("data-icon"), "copy",
      "copy-all phase actions use the shared copy icon");
    assert.match(await page.locator(".codex-section-panel__work").innerText(), /CPython garbage collection/);
    const commandEntry = page.locator(".codex-section-panel__work-item").filter({ hasText: "Get-Content agent.md" });
    const commandDetails = commandEntry.locator(".codex-section-panel__work-detail-expander");
    assert.equal(await commandDetails.count(), 1, "long action details should have an explicit expand control");
    assert.equal(await commandDetails.evaluate((element) => element.open), false, "long details start collapsed");
    const rawEventDetails = commandEntry.locator(".codex-section-panel__work-raw-expander");
    assert.equal(await rawEventDetails.count(), 1, "each phase with app-server events exposes aggregated event JSON");
    assert.equal(await rawEventDetails.evaluate((element) => element.open), false, "raw event JSON starts collapsed");
    await rawEventDetails.locator("summary").click();
    assert.match(await rawEventDetails.innerText(), /item\/started/);
    assert.match(await rawEventDetails.innerText(), /item\/completed/);
    assert.match(await rawEventDetails.innerText(), /完整诊断输出/);
    await page.evaluate(() => Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (value) => { window.copiedActivity = value; } },
    }));
    await page.locator(".codex-section-panel__work-copy-all").click();
    const copiedAllPhases = await page.evaluate(() => window.copiedActivity);
    assert.ok(copiedAllPhases.indexOf("检索资料") < copiedAllPhases.indexOf("执行命令\n\n命令：Get-Content agent.md"), "copy-all includes phase actions in timeline order");
    assert.ok(copiedAllPhases.includes("完整诊断输出。".repeat(100)), "copy-all includes the full recorded detail for every phase");
    assert.equal(await page.locator(".codex-section-panel__work").evaluate(el=>el.open),true,"copy-all does not collapse the phase-action container");
    await commandEntry.locator(".codex-section-panel__work-copy").click();
    const copiedPhase = await page.evaluate(() => window.copiedActivity);
    assert.match(copiedPhase, /^执行命令\n\n命令：Get-Content agent\.md/);
    assert.ok(copiedPhase.includes("完整诊断输出。".repeat(100)), "copy includes the full detail even while collapsed");
    assert.equal(await commandEntry.locator(".codex-section-panel__work-copy svg").getAttribute("data-icon"), "copy",
      "individual phase copy uses the shared copy icon");
    await commandDetails.locator("summary").click();
    assert.equal(await commandDetails.evaluate((element) => element.open), true, "long action details can be expanded in place");
    assert.match(await commandEntry.innerText(), /读取到 3 个对象/);
    await page.evaluate(() => {
      const container = document.querySelector(".codex-section-panel__work");
      const message = window.conversation.messages.at(-1);
      window.panel.updateActivityLog({
        summary: container.querySelector(".codex-section-panel__work-summary"),
        list: container.querySelector(".codex-section-panel__work-items"),
      }, message.activities);
    });
    assert.equal(await commandEntry.locator(".codex-section-panel__work-detail-expander").evaluate((element) => element.open), true,
      "expanded long details remain expanded when streamed activity updates rerender the list");
    assert.equal(await commandEntry.locator(".codex-section-panel__work-raw-expander").evaluate((element) => element.open), true,
      "expanded raw event JSON remains expanded when streamed activity updates rerender the list");
    await commandEntry.screenshot({ path: path.join(verificationDir, "phase-action-copy-expand.png") });
    await page.evaluate(async () => {
      window.panel.plugin.app = { workspace: { getActiveFile: () => ({ path: "agent/agent.md" }) } };
      window.panel.renderMessage({ role: "codex", content: "# 最终答复\n\n这是 **清晰** 的正文。", status: "complete" });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const markdownMessage = page.locator(".codex-section-panel__message--codex").last().locator(".codex-section-panel__message-content");
    assert.equal(await markdownMessage.getAttribute("data-markdown-rendered"), "true", "final Codex messages should pass through Obsidian MarkdownRenderer");
    assert.equal(await markdownMessage.getAttribute("data-markdown-api"), "render", "use the current MarkdownRenderer API when available");
    assert.match(await markdownMessage.innerText(), /最终答复/);
    assert.equal(await markdownMessage.locator("h1").innerText(), "最终答复", "Markdown headings should have readable hierarchy");
    assert.equal(await markdownMessage.locator("strong").innerText(), "清晰", "Markdown emphasis should be rendered rather than shown as asterisks");
    await page.locator(".codex-section-panel__message--codex").last().screenshot({ path: path.join(verificationDir, "markdown-answer.png") });
    await page.evaluate(async () => {
      const conversation = window.conversation;
      window.proposalTestPreviousMessages = conversation.messages;
      conversation.messages = [
        { id: "proposal-user", role: "user", content: "合并引用章节", createdAt: Date.now() - 2000, references: [
          { path: "note.md", marker: "[[note]] (L1:C1-L2:C1)", rangeLabel: "L1:C1-L2:C1", text: "## 原章节\n旧正文" },
        ] },
        { id: "proposal-codex", role: "codex", content: "我已整理合并建议。", createdAt: Date.now(), status: "complete",
          activities: [{ id: "proposal-action", label: "读取章节", status: "completed", startedAt: 1000, endedAt: 1300 }],
          replyToMessageId: "proposal-user", proposal: { summary: "合并章节并保留标题", edits: [{ contextIndex: 1, replacement: "## 合并章节\n\n新正文" }] }, editStatus: "pending" },
      ];
      window.panel.plugin.persistChatState = async () => {};
      window.panel.plugin.applyDocumentEdits = async (contexts, edits) => {
        window.appliedProposal = { contexts, edits };
        return { changed: true, paths: ["note.md"] };
      };
      window.panel.renderConversation();
    });
    const proposalBubble = page.locator(".codex-section-panel__message--codex").last();
    assert.equal(await proposalBubble.locator(".codex-section-panel__work").count(), 1);
    assert.equal(await proposalBubble.locator(".codex-section-panel__message-content").count(), 1);
    assert.equal(await proposalBubble.locator(".codex-section-panel__edit-proposal").count(), 1,
      "a valid structured edit response is rendered as a proposal inside its Codex message");
    const proposalOrder = await proposalBubble.evaluate(el => Array.from(el.children).map(child => child.className));
    assert.ok(proposalOrder.indexOf("codex-section-panel__work") < proposalOrder.indexOf("codex-section-panel__message-content"),
      "stage actions stay above the final answer");
    assert.ok(proposalOrder.indexOf("codex-section-panel__message-content") < proposalOrder.indexOf("codex-section-panel__edit-proposal"),
      "the readable answer stays visible before the foldable proposal");
    const proposalFold = proposalBubble.locator(".codex-section-panel__edit-proposal");
    assert.equal(await proposalFold.evaluate(el => el.open), false, "document changes start folded");
    assert.match(await proposalFold.locator("summary").innerText(), /合并章节并保留标题/);
    await proposalFold.locator("summary").click();
    await page.waitForFunction(() => document.querySelector(".codex-section-panel__edit-replacement")?.innerText.includes("新正文"));
    assert.equal(await proposalFold.locator(".codex-section-panel__edit-replacement h2").innerText(), "合并章节");
    assert.equal(await proposalFold.locator(".codex-section-panel__edit-replacement p").innerText(), "新正文");
    await proposalFold.locator(".codex-section-panel__edit-apply").click();
    assert.equal(await page.evaluate(() => window.conversation.messages.at(-1).editStatus), "applied",
      "the proposal is marked applied only after the Obsidian write succeeds");
    assert.equal(await page.evaluate(() => window.appliedProposal.contexts[0].path), "note.md",
      "confirmation applies the proposal to its originating note context");
    await page.evaluate(async () => {
      window.panel.renderMessage({ role: "codex", content: "已整理合并稿，但没有结构化修改建议。", status: "error",
        responseError: "Codex 回复未通过结构校验；未应用任何笔记修改。请点击重试。" });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const protocolErrorBubble = page.locator(".codex-section-panel__message--codex").last();
    assert.match(await protocolErrorBubble.locator(".codex-section-panel__message-content").innerText(), /已整理合并稿/,
      "the original Codex response remains readable when protocol validation fails");
    assert.match(await protocolErrorBubble.locator(".codex-section-panel__message-status").innerText(), /未应用任何笔记修改/,
      "the UI makes clear that no note was changed after a malformed edit response");
    assert.equal(await protocolErrorBubble.locator(".codex-section-panel__message-retry").count(), 1,
      "a malformed structured response exposes the existing manual retry action");
    await page.evaluate(() => { window.conversation.messages = window.proposalTestPreviousMessages; window.panel.renderConversation(); });
    const legacyStructuredResponse = [
      "我会读取引用章节并整理修改建议。",
      String.raw`{"edit":{"summary":"合并章节并保留内容","edits":[{"contextIndex":1,"replacement":""},{"contextIndex":2,"replacement":"## 垃圾回收机制\n\n第一段正文。\n\n### 引用计数\n\n- 使用 **CPython**。\n"}]}}`,
    ].join("\n");
    await page.evaluate(async (content) => {
      window.panel.renderMessage({ role: "codex", content, status: "complete" });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }, legacyStructuredResponse);
    const legacyMessage = page.locator(".codex-section-panel__message--codex").last().locator(".codex-section-panel__message-content");
    assert.doesNotMatch(await legacyMessage.innerText(), /"edit"|\\n/, "legacy protocol JSON and escaped newline markers must not leak into saved chat history");
    const legacyProposal = page.locator(".codex-section-panel__message--codex").last().locator(".codex-section-panel__edit-proposal");
    assert.equal(await legacyProposal.count(), 1, "legacy structured responses are parsed into a foldable proposal");
    await legacyProposal.locator("summary").click();
    await page.waitForFunction(() => document.querySelector(".codex-section-panel__edit-replacement h2")?.textContent.includes("垃圾回收机制"));
    assert.equal(await legacyProposal.locator(".codex-section-panel__edit-replacement h2").innerText(), "垃圾回收机制",
      "legacy replacement Markdown is rendered after expanding its proposal");
    assert.equal(await legacyProposal.locator(".codex-section-panel__edit-replacement h3").innerText(), "引用计数",
      "escaped paragraph separators become real line breaks in archived proposals");
    assert.equal(await legacyProposal.locator(".codex-section-panel__edit-replacement strong").innerText(), "CPython",
      "archived replacement Markdown is rendered, not shown as serialized JSON");
    const restored = await page.evaluate(() => {
      const restored=CodexSectionPanelTestAPI.normalizeChatState({conversations:[JSON.parse(JSON.stringify(window.conversation))]});
      window.conversation=restored.conversations[0];window.panel.renderConversation();
      return window.conversation.messages.at(-1).activities;
    });
    assert.ok(restored.length>=4, "completed messages retain their action history after reloading");
    await page.screenshot({ path: path.join(verificationDir, "actions-history.png") });
    // Failure and pause also keep public actions in the corresponding saved message.
    for (const outcome of ["failed", "interrupted"]) {
      await page.evaluate(async status=>{
        const panel=window.panel;
        const plugin=panel.plugin;
        if (status === "failed" && !window.originalRequestCodex) window.originalRequestCodex=plugin.requestCodex;
        if (status === "interrupted" && window.originalRequestCodex) plugin.requestCodex=window.originalRequestCodex;
        let subscriber;
        plugin.appServer={subscribe:cb=>{subscriber=cb;return()=>{subscriber=null}},startTurn:async()=>({turn:{id:"outcome-turn"}})};
        panel.promptInput.value="验证结束状态";
        const pending=panel.send();
        await new Promise(resolve=>setTimeout(resolve,0));
        subscriber({method:"item/started",params:{threadId:"ui-thread",turnId:"outcome-turn",item:{id:"outcome-command",type:"commandExecution",command:"检查笔记",status:"inProgress"}}});
        subscriber({method:"turn/completed",params:{threadId:"ui-thread",turn:{id:"outcome-turn",status,error:status==="failed"?{message:"测试失败"}:null}}});
        await pending;
      },outcome);
      const last=await page.evaluate(()=>window.conversation.messages.at(-1));
      assert.equal(last.status,outcome==="failed"?"error":"paused");
      assert.equal(last.activities.find(action=>action.id==="outcome-command").status,outcome);
      if (outcome === "failed") {
        const failedBubble = page.locator(".codex-section-panel__message--codex").last();
        assert.equal(await failedBubble.locator(".codex-section-panel__message-retry svg").getAttribute("data-icon"), "rotate-ccw",
          "a failed Codex response exposes the retry icon");
        const userCountBeforeRetry = await page.locator(".codex-section-panel__message--user").count();
        const failedId = last.id;
        await page.evaluate(() => {
          const plugin=window.panel.plugin;
          plugin.requestCodex=async (request, options) => {
            window.retryRequest={request,model:options.model};
            options.onDelta('{"intent":"answer","answer":"恢复测试成功。","edit":null}');
            return {cancelled:false,text:'{"intent":"answer","answer":"恢复测试成功。","edit":null}',activities:[]};
          };
        });
        await failedBubble.locator(".codex-section-panel__message-retry").click();
        await page.waitForFunction(id => {
          const message=window.conversation.messages.find(item=>item.id===id);
          return message&&message.status==="complete"&&message.content==="恢复测试成功。";
        }, failedId);
        assert.equal(await page.locator(".codex-section-panel__message--user").count(), userCountBeforeRetry,
          "retry reuses the original user message instead of duplicating it");
        assert.equal(await page.evaluate(id=>window.conversation.messages.find(item=>item.id===id).replyToMessageId,
          failedId), await page.evaluate(()=>window.conversation.messages.find(item=>item.role==="user"&&item.content==="验证结束状态").id),
          "the retried Codex bubble remains paired with its original user message");
        const retryRequest = await page.evaluate(()=>window.retryRequest);
        assert.equal(retryRequest.model,"gpt-6.1-sol","retry uses the model selected for the original request");
        assert.match(retryRequest.request,/用于重试验证/,"retry reuses the original cited body");
      }
    }
    await page.setViewportSize({width:390,height:640});
    await page.evaluate(() => {
      const host=document.querySelector(".host");host.style.inset="16px";
      host.style.transform="none";
      window.panel.renderMessage({role:"user",content:"引用",references:[{marker:"[[note]]",text:"窄窗口引用".repeat(100)}]});
    });
    await page.locator(".codex-section-panel__reference-button").last().hover();
    await page.waitForFunction(()=>document.querySelector(".codex-section-panel__reference-preview.is-open"));
    await page.waitForTimeout(180);
    const narrow=await page.locator(".codex-section-panel__reference-preview.is-open").boundingBox();
    assert.ok(narrow.x>=7 && narrow.x+narrow.width<=383 && narrow.y>=7 && narrow.y+narrow.height<=633,"narrow preview remains inside viewport");
    await page.screenshot({ path: path.join(verificationDir, "hover-narrow.png") });
    await page.evaluate(()=>window.panel.renderConversation());
    assert.equal(await page.locator("body > .codex-section-panel__reference-preview").count(),0,"rerender removes the portal and its listeners");
    await page.setViewportSize({width:1000,height:720});
    await page.evaluate(async () => {
      const plugin=new window.module.exports();
      plugin.chatState=CodexSectionPanelTestAPI.normalizeChatState({conversations:[{id:"layout-chat",title:"布局测试",messages:[]}]});
      plugin.settings={defaultModel:""};
      plugin.app={workspace:{getActiveFile:()=>null}};
      plugin.getActiveConversation=()=>plugin.chatState.conversations.find(item=>item.id===plugin.chatState.activeConversationId);
      plugin.getSourceMarkdownView=()=>null;
      plugin.persistChatState=async()=>{};
      plugin.listModels=async()=>[];
      const mount=document.createElement("div");
      mount.id="layout-verification-panel";
      mount.style.cssText="position:fixed;inset:12px 24px;width:520px;height:680px;z-index:5;background:#fff;overflow:hidden";
      document.body.append(mount);
      const fullPanel=new window.PanelView(null,plugin);
      fullPanel.containerEl=mount;
      await fullPanel.onOpen();
      window.fullPanel=fullPanel;
    });
    const composerLayout = await page.evaluate(() => {
      const { promptInput, modelSelect, sendButton, pauseButton, messagesEl } = window.fullPanel;
      const composer = promptInput.closest(".codex-section-panel__composer");
      const shell = promptInput.closest(".codex-section-panel__prompt-shell");
      const layout = document.querySelector("#layout-verification-panel .codex-section-panel__layout");
      return {
        shellContainsAllControls: Boolean(shell && shell.contains(modelSelect) && shell.contains(sendButton) && shell.contains(pauseButton)),
        composerBeforeLayout: Boolean(composer && layout && composer.compareDocumentPosition(layout) & Node.DOCUMENT_POSITION_FOLLOWING),
        resize: getComputedStyle(promptInput).resize,
        minHeight: getComputedStyle(promptInput).minHeight,
      };
    });
    assert.equal(composerLayout.composerBeforeLayout, true,
      "composer remains above the history and transcript layout rather than at the panel bottom");
    assert.equal(composerLayout.shellContainsAllControls, true,
      "model selection and send/pause controls are inside the input frame");
    assert.equal(composerLayout.resize, "vertical", "the input can be resized vertically");
    assert.notEqual(composerLayout.minHeight, "0px", "the input has a usable minimum height");
    assert.equal(await page.evaluate(()=>window.fullPanel.messagesEl.parentElement.classList.contains("codex-section-panel__chat")),true,
      "conversation messages remain in their independently scrolling chat area");
    const promptShell = page.locator("#layout-verification-panel .codex-section-panel__prompt-shell");
    const prompt = page.locator("#layout-verification-panel .codex-section-panel__prompt");
    const inputBeforeResize = await prompt.boundingBox();
    await page.mouse.move(inputBeforeResize.x + inputBeforeResize.width - 7, inputBeforeResize.y + inputBeforeResize.height - 7);
    await page.mouse.down();
    await page.mouse.move(inputBeforeResize.x + inputBeforeResize.width - 7, inputBeforeResize.y + inputBeforeResize.height + 48, { steps: 6 });
    await page.mouse.up();
    const resizedPrompt = await prompt.boundingBox();
    const inputAfterResize = await promptShell.boundingBox();
    assert.ok(resizedPrompt.height > inputBeforeResize.height + 20,
      "dragging the textarea resize handle increases its height");
    assert.ok(inputAfterResize.height > inputBeforeResize.height + 20,
      "resizing the textarea expands the shared input frame");
    assert.equal(await page.locator("#layout-verification-panel .codex-section-panel__empty").count(),1,
      "a new conversation has an empty chat area without inherited messages");
    assert.equal(await page.evaluate(()=>window.fullPanel.sendButton.querySelector("svg").getAttribute("data-icon")),"send");
    await page.locator("#layout-verification-panel").screenshot({path:path.join(verificationDir,"composer-layout-desktop.png")});
    await page.evaluate(()=>{window.fullPanel.plugin.chatState.historyCollapsed=true;window.fullPanel.renderHistorySidebarState()});
    const collapsedTracks=await page.locator(".codex-section-panel__layout").last().evaluate(el=>getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/).length);
    assert.equal(collapsedTracks,1,"a collapsed history sidebar overlays the edge toggle without reserving a grid column");
    await page.locator("#layout-verification-panel").screenshot({path:path.join(verificationDir,"composer-history-collapsed.png")});
    await page.setViewportSize({width:390,height:640});
    await page.evaluate(()=>{window.fullPanel.containerEl.style.width="360px";window.fullPanel.containerEl.style.height="600px"});
    await page.locator("#layout-verification-panel").screenshot({path:path.join(verificationDir,"composer-layout-mobile.png")});
    assert.deepEqual(errors,[]);
    console.log("ui tests passed: composer placement, embedded controls, adjustable input height, history deletion, phase actions, hover placement, streaming/retry, save/reload, narrow viewport");
  } finally { await browser.close(); }
}
run().catch(error=>{console.error(error);process.exitCode=1;});
