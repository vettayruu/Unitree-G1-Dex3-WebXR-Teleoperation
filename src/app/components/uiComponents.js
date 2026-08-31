let registered = false;
export default function uiComponents(options) {
  if (registered) return;
  registered = true;

  const {
    // Menu
    setHmdControl,
    setShowVideo,
    // setControlMode,
    setShowModel,
    setShareControl,
    setWholeBodyControl,
  } = options;
  
  AFRAME.registerComponent('highlight', {
    init: function () {
      var buttonEls = this.buttonEls = this.el.querySelectorAll('.menu-button');
      var backgroundEl = document.querySelector('#background');
      
      // 1. 传统业务保留原有的单选互斥组 (1对1开关)
      this.groups = [
        ['button1', 'button2'],
        ['button3', 'button4'],
        ['button5', 'button6'],
        ['button7', 'button8'],
        ['button9', 'button10']
      ];
      
      // 2. 将数据录制按钮划入独立名单，防止单选互斥逻辑破坏 React 渲染的状态
      this.dataRecordBtnIds = ['sap-data-start', 'sap-data-stop', 'sap-data-complete'];

      window.menuActiveBtnIds = window.menuActiveBtnIds || ['button1', 'button3', 'button5', 'button8', 'button10'];
      const activeBtnIds = window.menuActiveBtnIds;
      
      // 动态初始化数组长度，防止写死长度导致越界
      this.activeBtns = new Array(this.groups.length).fill(null);

      this.onClick = this.onClick.bind(this);
      this.onMouseEnter = this.onMouseEnter.bind(this);
      this.onMouseLeave = this.onMouseLeave.bind(this);
      this.reset = this.reset.bind(this);

      // 初始化前5组单选按钮的绿光高亮
      for (let groupIdx = 0; groupIdx < this.groups.length; ++groupIdx) {
        const btnId = activeBtnIds[groupIdx];
        const el = document.getElementById(btnId);
        if (el) {
          el.setAttribute('material', 'color', '#00ff00');
          this.activeBtns[groupIdx] = el;
        }
      }
      
      // 初始化普通按钮的底色，并绑定交互事件
      for (var i = 0; i < buttonEls.length; ++i) {
        const btn = buttonEls[i];
        // 只对前 5 组传统按钮进行底色置白初始化（数据流按钮颜色由 React 接管）
        if (!activeBtnIds.includes(btn.id) && !this.dataRecordBtnIds.includes(btn.id)) {
          btn.setAttribute('material', 'color', 'white');
        }
        btn.addEventListener('mouseenter', this.onMouseEnter);
        btn.addEventListener('mouseleave', this.onMouseLeave);
        btn.addEventListener('click', this.onClick);
      }
      if (backgroundEl) backgroundEl.addEventListener('click', this.reset);
    },

    getGroupIndex: function (btnId) {
      for (let i = 0; i < this.groups.length; ++i) {
        if (this.groups[i].includes(btnId)) return i;
      }
      return -1;
    },

    onClick: function (evt) {
      const btnId = evt.target.id;
      
      // 👉 拦截：如果是数据录制按钮，点击时跳过 A-Frame 的颜色覆盖，完全留给 React 处理
      if (this.dataRecordBtnIds.includes(btnId)) return;

      const groupIdx = this.getGroupIndex(btnId);
      if (groupIdx === -1) return;
      
      for (const id of this.groups[groupIdx]) {
        const el = document.getElementById(id);
        if (el) el.setAttribute('material', 'color', 'white');
      }
      evt.target.setAttribute('material', 'color', '#00ff00');
      this.activeBtns[groupIdx] = evt.target;
      window.menuActiveBtnIds[groupIdx] = btnId;
      this.el.addState('clicked');
    },

    onMouseEnter: function (evt) {
      const btnId = evt.target.id;

      if (['sap-data-start', 'sap-data-stop'].includes(btnId)) return;
      
      // 👉 如果是数据流按钮且处于被禁用状态（无 raycastable），不触发悬停高亮
      if (this.dataRecordBtnIds.includes(btnId) && !evt.target.classList.contains('raycastable')) return;

      const groupIdx = this.getGroupIndex(btnId);
      // 普通按钮如果没有被激活，或者数据录制按钮悬停时，提供标志性的蓝色悬停反馈
      if (groupIdx === -1 || evt.target !== this.activeBtns[groupIdx]) {
        // 临时存储原有颜色，用于 Leave 时恢复（针对 React 按钮动态色极其有用）
        // evt.target.setAttribute('data-pre-hover-color', evt.target.getAttribute('material').color);
        evt.target.setAttribute('material', 'color', '#046de7');
      }
    },

    onMouseLeave: function (evt) {
      const btnId = evt.target.id;

      if (['sap-data-start', 'sap-data-stop'].includes(btnId)) return;
      
      const groupIdx = this.getGroupIndex(btnId);
      
      if (this.dataRecordBtnIds.includes(btnId)) {
        // 👉 数据流按钮恢复 React 赋予它们的本色
        const preColor = evt.target.getAttribute('data-pre-hover-color') || '#333333';
        evt.target.setAttribute('material', 'color', preColor);
        return;
      }

      if (groupIdx === -1) return;
      if (evt.target !== this.activeBtns[groupIdx]) {
        evt.target.setAttribute('material', 'color', 'white');
      }
    },

    reset: function () {
      for (let i = 0; i < this.groups.length; ++i) {
        for (const id of this.groups[i]) {
          const el = document.getElementById(id);
          if (el) el.setAttribute('material', 'color', 'white');
        }
        this.activeBtns[i] = null;
      }
      this.el.removeState('clicked');
    }
  });

  // 👉 保持原样，纯粹处理非 React 状态的业务绑定
  AFRAME.registerComponent('button-action', {
    init: function () {
      const buttonEls = document.querySelectorAll('.menu-button');
      for (let i = 0; i < buttonEls.length; ++i) {
        buttonEls[i].addEventListener('click', (evt) => {
          const btnId = evt.currentTarget.id;
          if (btnId === "button1") { setHmdControl(false); } 
          else if (btnId === "button2") { setHmdControl(true); } 
          else if (btnId === "button3") { setShowVideo(false); } 
          else if (btnId === "button4") { setShowVideo(true); } 
          else if (btnId === "button5") { setShowModel(true); } 
          else if (btnId === "button6") { setShowModel(false); } 
          else if (btnId === "button7") { setShareControl(true); } 
          else if (btnId === "button8") { setShareControl(false); } 
          else if (btnId === "button9") { setWholeBodyControl(true); } 
          else if (btnId === "button10") { setWholeBodyControl(false); } 
        });
      }
    }
  });
}