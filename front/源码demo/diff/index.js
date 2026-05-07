//创建vNode对象
const h = (tag, data = {}, children) => {
  let text = ''
  let el
  let key
  // 文本节点
  if (typeof children === 'string' || typeof children === 'number') {
    text = children
    children = undefined
  } else if (!Array.isArray(children)) {
    children = undefined
  }
  if (data && data.key) {
    key = data.key
  }
  return {
    tag, // 元素标签
    children, // 子元素
    text, // 文本节点的文本
    el, // 真实dom
    key,
    data //样式，class类，事件等
  }
}

//处理样式
const handleStyle = {
  updateClass: (el, newVNode) => {
    el.className = ''
    if (newVNode.data && newVNode.data.class) {
      let className = ''
      Object.keys(newVNode.data.class).forEach((cla) => {
        if (newVNode.data.class[cla]) {
          className += cla + ' '
        }
      })
      el.className = className
    }
  },
  updateStyle: (el, oldVNode, newVNode) => {
    let oldStyle = oldVNode && oldVNode.data && oldVNode.data.style || {}
    let newStyle = newVNode && newVNode.data && newVNode.data.style || {}
    // 移除旧节点里存在新节点里不存在的样式
    Object.keys(oldStyle).forEach((item) => {
      if (newStyle[item] === undefined || newStyle[item] === '') {
        el.style[item] = ''
      }
    })
    // 添加旧节点不存在的新样式
    Object.keys(newStyle).forEach((item) => {
      if (oldStyle[item] !== newStyle[item]) {
        el.style[item] = newStyle[item]
      }
    })
  },
  updateAttr: (el, oldVNode, newVNode) => {
    let oldAttr = oldVNode && oldVNode.data && oldVNode.data.attr ? oldVNode.data.attr : {}
    let newAttr = newVNode && newVNode.data && newVNode.data.attr || {}
    // 移除旧节点里存在新节点里不存在的属性
    Object.keys(oldAttr).forEach((item) => {
      if (newAttr[item] === undefined || newAttr[item] === '') {
        el.removeAttribute(item)
      }
    })
    // 添加旧节点不存在的新属性
    Object.keys(newAttr).forEach((item) => {
      if (oldAttr[item] !== newAttr[item]) {
        el.setAttribute(item, newAttr[item])
      }
    })
  }
}


//处理事件
const handleEvent = {
  removeEvent: (oldVNode) => {
    console.log();
    if (oldVNode && oldVNode.data && oldVNode.data.event) {
      Object.keys(oldVNode.data.event).forEach((item) => {
        oldVNode.el.removeEventListener(item, oldVNode.data.event[item])
      })
    }
  },
  updateEvent: (el, oldVNode, newVNode) => {
    let oldEvent = oldVNode && oldVNode.data && oldVNode.data.event ? oldVNode.data.event : {}
    let newEvent = newVNode && newVNode.data && newVNode.data.event || {}
    // 移除旧节点里存在新节点里不存在的事件
    Object.keys(oldEvent).forEach((item) => {
      if (newEvent[item] === undefined || oldEvent[item] !== newEvent[item]) {
        el.removeEventListener(item, oldEvent[item])
      }
    })
    // 添加旧节点不存在的新事件
    Object.keys(newEvent).forEach((item) => {
      if (oldEvent[item] !== newEvent[item]) {
        el.addEventListener(item, newEvent[item])
      }
    })
  }
}

//渲染dom
const createEl = (vnode) => {
  console.log(vnode);
  let el = document.createElement(vnode.tag)
  vnode.el = el;
  if (Array.isArray(vnode) && vnode.children && vnode.children.length > 0) {
    vnode.children.forEach((item) => {
      el.appendChild(createEl(item))
    })
  } else {
    vnode.text = vnode.children
    vnode.children = undefined
  }
  if (vnode.text) {
    el.appendChild(document.createTextNode(vnode.text))
  }
  console.log('createEl:vnode', vnode);
  return el
}

//判断是否是同一个节点
const isSameNode = (a, b) => {
  return a.key === b.key && a.tag === b.tag
}

//在节点列表里寻找同个节点，返回索引
const findSameNode = (list, node) => {
  return list.findIndex((item) => {
    return item && isSameNode(item, node)
  })
}

//diff算法
const diff = (el, oldChildren, newChildren) => {
  console.log('diff');
  // 指针
  let oldStartIdx = 0
  let oldEndIdx = oldChildren.length - 1
  let newStartIdx = 0
  let newEndIdx = newChildren.length - 1
  // 节点
  let oldStartVNode = oldChildren[oldStartIdx]
  let oldEndVNode = oldChildren[oldEndIdx]
  let newStartVNode = newChildren[newStartIdx]
  let newEndVNode = newChildren[newEndIdx]
  //子节点个数都要大于1
  while (oldStartIdx <= oldEndIdx && newStartIdx <= newEndIdx) {
    if (oldStartVNode === null) {
      oldStartVNode = oldChildren[++oldStartIdx]
    } else if (oldEndVNode === null) {
      oldEndVNode = oldChildren[--oldEndIdx]
    } else if (newStartVNode === null) {
      newStartVNode = oldChildren[++newStartIdx]
    } else if (newEndVNode === null) {
      newEndVNode = oldChildren[--newEndIdx]
    } else if (isSameNode(oldStartVNode, newStartVNode)) { // 头-头
      console.log('头-头', oldStartVNode, newStartVNode);
      // 更新指针
      oldStartVNode = oldChildren[++oldStartIdx]
      newStartVNode = newChildren[++newStartIdx]
    } else if (isSameNode(oldStartVNode, newEndVNode)) { // 头-尾
      console.log('头-尾');
      patchVNode(oldStartVNode, newEndVNode)
      // 把oldStartVNode节点移动到最后
      el.insertBefore(oldStartVNode.el, oldEndVNode.el.nextSibling)
      // 更新指针
      oldStartVNode = oldChildren[++oldStartIdx]
      newEndVNode = newChildren[--newEndIdx]
    } else if (isSameNode(oldEndVNode, newStartVNode)) { // 尾-头
      console.log('尾-头');

      patchVNode(oldEndVNode, newStartVNode)
      // 把oldEndVNode节点移动到oldStartVNode前
      el.insertBefore(oldEndVNode.el, oldStartVNode.el)
      // 更新指针
      oldEndVNode = oldChildren[--oldEndIdx]
      newStartVNode = newChildren[++newStartIdx]
    } else if (isSameNode(oldEndVNode, newEndVNode)) { // 尾-尾
      console.log('尾-尾');

      patchVNode(oldEndVNode, newEndVNode)
      // 更新指针
      oldEndVNode = oldChildren[--oldEndIdx]
      newEndVNode = newChildren[--newEndIdx]
    } else {
      console.log('insertBefore');
      let findIndex = findSameNode(oldChildren, newStartVNode)
      // newStartVNode在旧列表里不存在，那么是新节点，创建插入
      if (findIndex === -1) {
        el.insertBefore(createEl(newStartVNode), oldStartVNode.el)
      } else { // 在旧列表里存在，那么进行patch，并且移动到oldStartVNode前
        let oldVNode = oldChildren[findIndex]
        patchVNode(oldVNode, newStartVNode)
        el.insertBefore(oldVNode.el, oldStartVNode.el)
        oldChildren[findIndex] = null
      }
      newStartVNode = newChildren[++newStartIdx]
    }
  }
  // 旧列表里存在新列表里没有的节点，需要删除
  if (oldStartIdx <= oldEndIdx) {
    for (let i = oldStartIdx; i <= oldEndIdx; i++) {
      handleEvent.removeEvent(oldChildren[i])
      oldChildren[i] && el.removeChild(oldChildren[i].el)
    }
  } else if (newStartIdx <= newEndIdx) {
    let before = newChildren[newEndIdx + 1] ? newChildren[newEndIdx + 1].el : null
    for (let i = newStartIdx; i <= newEndIdx; i++) {
      el.insertBefore(createEl(newChildren[i]), before)
    }
  }
}

//打补丁，针对同级的节点处理
const patchVNode = (oldVNode, newVNode) => {
  console.log('patchVNode', oldVNode, newVNode);
  if (oldVNode === newVNode) {
    return
  }
  // 元素标签相同
  if (oldVNode.tag === newVNode.tag) {
    // 元素类型相同，那么新元素可以复用旧元素的dom节点
    newVNode.el = oldVNode.el;
    let el = newVNode.el;
    console.log(oldVNode, newVNode);
    handleStyle.updateClass(el, newVNode)
    handleStyle.updateStyle(el, oldVNode, newVNode)
    handleStyle.updateAttr(el, oldVNode, newVNode)
    handleEvent.updateEvent(el, oldVNode, newVNode)
    // 新节点的子节点是文本节点,那么就直接替换
    if (newVNode.text) {
      // 移除旧节点的子节点
      if (oldVNode.children) {
        console.log(oldVNode.children);
        oldVNode.children.forEach((item) => {
          console.log(item);
          handleEvent.removeEvent(item)
        })
      }
      // 文本内容不相同则更新文本
      if (oldVNode.text !== newVNode.text) {
        el.textContent = newVNode.text
      }
    } else {
      // 新旧节点都存在子节点，那么就要进行diff
      if (oldVNode.children && newVNode.children) {
        diff(el, oldVNode.children, newVNode.children)
      } else if (newVNode.children) { // 新节点存在子节点，旧节点不存在
        // 旧节点存在文本节点则移除
        if (oldVNode.text) {
          el.textContent = ''
        }
        // 添加新节点的子节点
        newVNode.children.forEach((item, index) => {
          el.appendChild(createEl(newVNode.children[index]))
        })
      } else if (oldVNode.children) { // 新节点不存在子节点，那么移除旧节点的所有子节点
        oldVNode.children.forEach((item) => {
          handleEvent.removeEvent(item)
          el.removeChild(item.el)
        })
      } else if (oldVNode.text) { // 新节点啥也没有，旧节点存在文本节点
        el.textContent = ''
      }
    }
  } else { // 标签不同，根据新的VNode创建新的dom节点，然后插入新节点，移除旧节点
    let newEl = createEl(newVNode)
    updateClass(newEl, newVNode)
    updateStyle(newEl, null, newVNode)
    updateAttr(newEl, null, newVNode)
    handleEvent.removeEvent(oldNode)
    updateEvent(newEl, null, newVNode)
    let parent = oldVNode.el.parentNode
    parent.insertBefore(newEl, oldVNode.el)
    parent.removeChild(oldVNode.el)
  }
}

//入口方法
const patch = (oldVNode, newVNode) => {
  console.log('patch', oldVNode, oldVNode.tag, oldVNode.tagName, 'oldVNode');
  // 初始化的时候，dom元素转换成vnode
  if (!oldVNode.tag) {
    let el = oldVNode
    el.innerHTML = ''
    oldVNode = h(oldVNode.tagName.toLowerCase())
    oldVNode.el = el
  }
  patchVNode(oldVNode, newVNode)
  return newVNode
}

