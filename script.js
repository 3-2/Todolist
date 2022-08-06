let storageCenter = null;
function StorageCenter(obj) {
    this.userData = {
        taskItemData: [],
        groupItemData: [{ name: defaultGroupName }]
    };
    this.userStatus = {
        currentGroup: defaultGroupName,
        focusingTask: null
    };
    Object.keys(obj).map(p => this[p] = obj[p]);
}
StorageCenter.prototype.addTask = function (taskItemObject) {
    this.userData.taskItemData.push(taskItemObject);
};
StorageCenter.prototype.addGroup = function (groupItemObject) {
    this.userData.groupItemData.push(groupItemObject);
};
StorageCenter.prototype.deleteTask = function (timestamp) {
    let index = storageCenter.userData.taskItemData.findIndex(e => e.createdAt === timestamp);
    storageCenter.userData.taskItemData.splice(index, 1);
};
StorageCenter.prototype.deleteGroup = function (groupName) {
    let index = storageCenter.userData.groupItemData.findIndex(e => e.name === groupName);
    storageCenter.userData.groupItemData.splice(index, 1);
    // 删除该分组内的所有事项
    storageCenter.userData.taskItemData = storageCenter.userData.taskItemData.filter(e => e.group !== groupName);
    if (storageCenter.userStatus.currentGroup === groupName) { // 如果被删的分组是活跃分组
        if (storageCenter.userData.groupItemData[index] !== undefined) { // 此时 index 指向被删的下一个元素，如果没有越界
            storageCenter.userStatus.currentGroup = storageCenter.userData.groupItemData[index].name;
        }
        else { // 如果越界，即活跃分组变为上一分组
            storageCenter.userStatus.currentGroup = storageCenter.userData.groupItemData[index - 1].name;
        }
    }
};
StorageCenter.prototype.renameGroup = function (oldName, newName) {
    // 修改分组对象的 name
    storageCenter.findGroupItemObject(oldName).name = newName;
    for (taskItem of storageCenter.userData.taskItemData) {
        if (taskItem.group === oldName) {
            taskItem.group = newName;
        }
    }
    // 如果重命名的分组是活跃的分组
    if (oldName === storageCenter.userStatus.currentGroup) {
        storageCenter.userStatus.currentGroup = newName;
    }
};
StorageCenter.prototype.findTaskItemObject = function (timestamp) {
    for (taskItem of this.userData.taskItemData) {
        if (taskItem.createdAt === timestamp) {
            return taskItem;
        }
    }
};
StorageCenter.prototype.findGroupItemObject = function (groupName) {
    for (groupItem of this.userData.groupItemData) {
        if (groupName === groupItem.name) {
            return groupItem;
        }
    }
};
StorageCenter.prototype.focusOnTask = function (taskItemNode) {
    let timestamp = Number(taskItemNode.getAttribute('timestamp'));
    storageCenter.userStatus.focusingTask = timestamp;
    taskItemNode.setAttribute('isFocusing', 'true');
}
function pauseToLocalStorage() {
    localStorage.setItem('pausedData', JSON.stringify(storageCenter));
}
function resumeFromLocalStorage() {
    storageCenter = new StorageCenter(JSON.parse(localStorage.getItem('pausedData')));
}
function TaskItem(data) {
    // 事项对象的默认 property
    this.text = '空事项';
    this.isDone = false;
    this.createdAt = new Date().getTime();
    this.group = storageCenter.userStatus.currentGroup;
    this.deadline = null;
    Object.keys(data).map(p => this[p] = data[p]);
}
function GroupItem(data) {
    // 分组对象的默认 property
    this.name = '未命名分组';
    Object.keys(data).map(p => this[p] = data[p]);
}
function UserStatus(obj) {
    // 用户状态对象的默认 property
    this.currentGroup = null;
    Object.keys(obj).map(p => this[p] = obj[p]);
}
// refresh UI
function refreshBody() {
    refreshGroupList();
    refreshTaskContainer();
    refreshCurrentGroupName();
}
function refreshGroupList() {
    // 先清空
    let groupListElement = document.getElementById('groupList');
    groupListElement.innerHTML = '';
    let e = document.createElement('div');
    e.innerHTML = `
<div>
    <div class="groupItem" id="allTasks">
        <div class="groupName">全部事项</div>
        <div class="groupTrailing">
            <div class="taskNumber">${storageCenter.userData.taskItemData.filter(e => !e.isDone).length}</div>
        </div>
    </div>
    <div class="groupItem" id="toDeadline">
        <div class="groupName">将要截止</div>
        <div class="groupTrailing">
            <div class="taskNumber">${storageCenter.userData.taskItemData.filter(e => e.deadline && !e.isDone).length}</div>
        </div>
    </div>
</div>
    `
    groupListElement.appendChild(e.getElementsByTagName('div')[0]); // 以后优化一下怎么从 HTML字符串创建元素，这行代码导致多了一个空的 div
    storageCenter.userData.groupItemData.forEach(e => groupListElement.appendChild(createElement_groupItem(new GroupItem(e))));
    document.getElementById('groupList').setAttribute('remainingGroups', storageCenter.userData.groupItemData.length);
}
function refreshTaskContainer() {
    let completedDIV = document.getElementById('completed');
    let incompleteDIV = document.getElementById('incomplete');
    completedDIV.innerHTML = '';
    incompleteDIV.innerHTML = '';
    let currentGroup = storageCenter.userStatus.currentGroup;
    switch (currentGroup) {
        case virtualGroupName:
            storageCenter.userData.taskItemData.forEach(e => {
                if (e.isDone) {
                    completedDIV.appendChild(createElement_taskItem(new TaskItem(e)));
                }
                else {
                    incompleteDIV.appendChild(createElement_taskItem(new TaskItem(e)));
                }
            });
            break;
        case '将要截止':
            let taskItemsWithDeadline = storageCenter.userData.taskItemData.filter(e => e.deadline);
            let sorted = taskItemsWithDeadline.sort((a, b) => a.deadline - b.deadline);
            incompleteDIV.innerHTML = `
<div id="expired" class="grouping">过期</div>
<div id="today" class="grouping">今天</div>
<div id="tomorrow" class="grouping">明天</div>
<div id="thisWeek" class="grouping">本周</div>
<div id="future" class="grouping">以后</div>
            `
            let t = new Date().getTime();
            function grouping(timespan) {
                if (timespan <= 0) return 'expired';
                if (timespan < 86400000) return 'today';
                if (timespan < 172800000) return 'tomorrow';
                if (timespan < 604800000) return 'thisWeek';
                // return 'future';
            }
            sorted.forEach(e => {
                if (e.isDone) {
                    completedDIV.appendChild(createElement_taskItem(new TaskItem(e)));
                }
                else {
                    switch (grouping(e.deadline - t)) {
                        case 'expired':
                            incompleteDIV.querySelector('#expired').appendChild(createElement_taskItem(new TaskItem(e)));
                            break;
                        case 'today':
                            incompleteDIV.querySelector('#today').appendChild(createElement_taskItem(new TaskItem(e)));
                            break;

                        case 'tomorrow':
                            incompleteDIV.querySelector('#tomorrow').appendChild(createElement_taskItem(new TaskItem(e)));
                            break;

                        case 'thisWeek':
                            incompleteDIV.querySelector('#thisWeek').appendChild(createElement_taskItem(new TaskItem(e)));
                            break;

                        default:
                            incompleteDIV.querySelector('#future').appendChild(createElement_taskItem(new TaskItem(e)));
                            break;
                    }
                }
            });
            for (grouped of incompleteDIV.children) { // 每个分段（「今天」「明天」……）有任务的话，就显示，否则默认隐藏
                if (grouped.childElementCount) {
                    grouped.style.display = 'block';
                }
            };
            break;
        default:
            for (taskItem of storageCenter.userData.taskItemData) {
                if (taskItem.group === currentGroup) {
                    if (taskItem.isDone) {
                        completedDIV.appendChild(createElement_taskItem(new TaskItem(taskItem)));
                    }
                    else {
                        incompleteDIV.appendChild(createElement_taskItem(new TaskItem(taskItem)));
                    }
                }
            }
            break;
    }
}
function refreshCurrentGroupName() {
    document.querySelector('#topBar > div').textContent = storageCenter.userStatus.currentGroup;
}
const defaultGroupName = '默认分组';
const virtualGroupName = '全部事项';
// 业务：启动网页
window.addEventListener('load', function () {
    if (localStorage.getItem('pausedData') === null || localStorage.getItem('pausedData') === '{}') { // 全新启动的判断由 == null 换成了 == {}
        storageCenter = new StorageCenter({});
        refreshBody();
    }
    else {
        resumeFromLocalStorage();
        refreshBody();
    }
})
// 业务：关闭网页
window.addEventListener('pagehide', function () { // 仅在关闭网页时备份
    pauseToLocalStorage();
});
window.addEventListener('orientationchange', function () {
    let ElementsSwitchingGroupsInPortrait = document.querySelectorAll('[isSwitchingGroupsInPortrait="true"]'); // 当前是否处于竖屏时的切换分组状态下
    if (ElementsSwitchingGroupsInPortrait.length) {
        for (element of ElementsSwitchingGroupsInPortrait) {
            element.setAttribute('isSwitchingGroupsInPortrait', 'false');
        }
    }
})
let globalTest;
document.body.addEventListener('input', (event) => {
    if (event.target.tagName === 'SELECT') {
        if (event.target.name === 'dropDownGroupOptions') {
            switch (event.target.value) {
                case 'rename': {
                    let userInput = prompt('请输入新的分组名称');
                    let flag = true; // 很C语言
                    if (userInput !== null) { // 用户没点「取消」
                        if (userInput !== '') {
                            for (groupItem of storageCenter.userData.groupItemData) {
                                if (groupItem.name === userInput) {
                                    flag = false;
                                    alert('已有名为' + userInput + '的分组');
                                    break; // 很C语言
                                }
                            }
                            if (flag) { // 很C语言
                                let groupItemNode = event.target.closest('.groupItem');
                                let oldName = groupItemNode.getAttribute('groupName');
                                storageCenter.renameGroup(oldName, userInput);
                                refreshGroupList();
                                refreshCurrentGroupName();
                            }
                        }
                        else { alert('分组名称不能为空') }
                    }
                }
                    break;
                case 'delete': {
                    let groupItemNode = event.target.closest('.groupItem');
                    let groupName = groupItemNode.getAttribute('groupName');
                    let number = storageCenter.userData.taskItemData.filter(e => e.group === groupName).length;
                    if (confirm(number ? "确认删除" + groupName + "分组？这将会删除该分组中共计" + number + "个事项。" : '确认删除分组？（该分组中无任务）')) {
                        storageCenter.deleteGroup(groupName);
                        refreshBody();
                    }
                }
                    break;
            }
        }
        event.target.value = 'edit' //让下拉菜单回到第一个option
    }
});
// 听说这是公交车？
document.body.addEventListener('click', function (event) {
    if (event.target.id === 'expandGroups') {
        ['sidebar', 'right'].forEach(e => {
            document.getElementById(e).setAttribute('isSwitchingGroupsInPortrait', 'true');
        })
    }
    if (event.target.id === 'reset') {
        localStorage.clear();
        storageCenter = {};
        location.reload();//刷新
    }
    if (event.target.id === 'addTask') {
        let userInput = document.getElementById('addNewTask').value;
        if (userInput !== '') {
            let newTaskItem = new TaskItem({ text: userInput }); // 构造新任务的对象
            if (storageCenter.userStatus.currentGroup === virtualGroupName) { // 如果活跃分组是虚拟分组「全部事项」
                newTaskItem.group = storageCenter.userData.groupItemData[0].name; // 则新任务对象的分组property变为第一个分组
            }
            storageCenter.addTask(newTaskItem);
            refreshBody();
        }
        document.getElementById('addNewTask').value = '';
    }
    if (event.target.id === 'addGroup') {
        let userInput = prompt('请输入新分组的名称');
        let flag = true; // 很C语言
        if (userInput !== null) { // 用户没点「取消」
            if (userInput !== '') {
                for (groupItem of storageCenter.userData.groupItemData) {
                    if (groupItem.name === userInput) {
                        flag = false;
                        alert('已有名为' + userInput + '的分组');
                        break; // 很C语言
                    }
                }
                if (flag) { // 很C语言
                    storageCenter.addGroup(new GroupItem({ name: userInput }));
                    refreshGroupList();
                }
            }
            else { alert('分组名称不能为空') }
        }
    }
    if (event.target.classList.contains('deleteTask')) {
        let taskItemNode = event.target.closest('.taskItem');
        let timestamp = Number(taskItemNode.getAttribute('timestamp'));
        storageCenter.deleteTask(timestamp);
        storageCenter.userStatus.focusingTask = null;
        refreshTaskContainer();
        refreshGroupList();
    }
    if (event.target.classList.contains('isDone')) {
        let taskItemNode = event.target.closest('.taskItem');
        let timestamp = Number(taskItemNode.getAttribute('timestamp'));
        let taskItem = storageCenter.findTaskItemObject(timestamp);
        taskItem.isDone ? taskItem.isDone = false : taskItem.isDone = true;
        refreshBody();
    }
    if (event.target.classList.contains('groupName')) {
        storageCenter.userStatus.currentGroup = event.target.textContent;
        storageCenter.userStatus.focusingTask = null;
        if (window.matchMedia('(orientation: portrait)')) {
            for (element of document.querySelectorAll('[isSwitchingGroupsInPortrait="true"]')) {
                element.setAttribute('isSwitchingGroupsInPortrait', 'false');
            }

        }
        refreshCurrentGroupName();
        refreshTaskContainer();
    }
    if (event.target.id === 'export') {
        prompt('', JSON.stringify(storageCenter.userData));
    }
    if (event.target.id === 'import') {
        if (confirm('确定导入数据？警告：这会覆盖当前已有的数据。')) {
            try {
                let imported = JSON.parse(prompt());
                if (imported !== null) { // 用户没点「取消」
                    storageCenter = new StorageCenter({ userData: imported });
                    storageCenter.userStatus.currentGroup = imported.groupItemData[0].name;
                    refreshBody();
                }
            }
            catch (e) {
                alert('输入格式不正确，请检查确认后重试');
            }
        }
    }
    if (event.target.closest('.taskItem') === null && document.querySelector('.taskItem[isFocusing="true"]')) { // 点击当前聚焦的任务之外的地方则关闭 taskOptions
        storageCenter.userStatus.focusingTask = null;
        document.querySelector('.taskItem[isFocusing="true"]').setAttribute('isFocusing', 'false');
    }
    if (event.target.classList.contains('setDeadline')) {
        let taskItemNode = event.target.closest('.taskItem');
        let timestamp = Number(taskItemNode.getAttribute('timestamp'));
        let taskItem = storageCenter.findTaskItemObject(timestamp);
        taskItem.deadline === null ? taskItem.deadline = '' : taskItem.deadline = null;
        // refreshTaskContainer(); // 以后改写为只刷新 taskDetails，即把 taskDetails Div 从 createElement_taskItem 中拆出来
        refreshBody();
    }
})
// 画 HTML 元素
function createElement_taskItem(taskItemObject) {
    let e = document.createElement('div');
    e.innerHTML = `
    <div class="taskItem" isFocusing="${storageCenter.userStatus.focusingTask === taskItemObject.createdAt ? 'true' : 'false'}" timestamp="${taskItemObject.createdAt}">
    <div class="taskMain">
        <div class="taskBox">
        <input type="checkbox" class="isDone">
    <input class="taskBox-inputTag taskContent" type="text" value="${taskItemObject.text}">
    </div>
    <div class="taskDetails">
    </div>
    </div>

<div class="taskOptions">
    <input type="checkbox" class="setDeadline">截止时间
    <button class="deleteTask">删除</button>
</div>

    </div>
    `;
    e.querySelector('.isDone').checked = taskItemObject.isDone ? true : false;
    let taskDetails = e.querySelector('.taskDetails');
    // 未来优化一下，抽出 taskDetails 的画 UI 过程
    if (taskItemObject.deadline !== null) { // 如果有截止时间数据
        e.querySelector('.setDeadline').checked = true;
        taskDetails.innerHTML += '<input type="datetime-local" class="deadline">';
        taskDetails.querySelector('.deadline').addEventListener('input', function () {
            let taskItemNode = event.target.closest('.taskItem');
            let timestamp = Number(taskItemNode.getAttribute('timestamp'));
            storageCenter.findTaskItemObject(Number(timestamp)).deadline = new Date(event.target.value + ':00.000Z').getTime(); // 转换为Unix时间戳放入存储中心，使用 UTC+0 时间
            refreshGroupList();
        });
        if (taskItemObject.deadline !== '' && isNaN(taskItemObject.deadline) === false) { // 如果截止时间不为空
            taskDetails.querySelector('.deadline').value = new Date(taskItemObject.deadline).toISOString().slice(0, 16);
        } // 将时间戳转换为 datetime-local 可接受的格式
    }
    else {
        e.querySelector('.setDeadline').checked = false;
    }
    e.querySelector('.taskContent').addEventListener('focus', function (event) {
        let taskItemNode = event.target.closest('.taskItem');
        let timestamp = Number(taskItemNode.getAttribute('timestamp'));
        if (storageCenter.userStatus.focusingTask) { // 如果有任务处于焦点中
            if (taskItemNode.getAttribute('isFocusing') === 'false') { // 如果鼠标点到的任务不是聚焦的任务
                document.querySelector('.taskItem[isFocusing="true"]').setAttribute('isFocusing', 'false');
                storageCenter.focusOnTask(taskItemNode);
            }
        }
        else {
            storageCenter.focusOnTask(taskItemNode);
        }
    });
    e.querySelector('.taskContent').addEventListener('blur', function (event) {
        if (event.target.value == "") {
            event.target.value = "空事项"
        }
        let taskItemNode = event.target.closest('.taskItem');
        let timestamp = Number(taskItemNode.getAttribute('timestamp'));
        storageCenter.findTaskItemObject(Number(timestamp)).text = event.target.value;
    })
    return e.getElementsByTagName('div')[0]; // 相当于返回上面的字符串（要保证字符串中的顶层元素只有一个）
}
function createElement_groupItem(groupItemObject) {
    function insideTaskNumber() {
        return storageCenter.userData.taskItemData.filter(e => e.group === groupItemObject.name && !e.isDone).length
    }
    let e = document.createElement('div');
    e.innerHTML = `
    <div class="groupItem" groupName="${groupItemObject.name}">
    <div class="groupName">${groupItemObject.name}</div>
    <div class="groupTrailing">
        <div class="taskNumber">${insideTaskNumber()}</div>
    <select class="groupOptions" name="dropDownGroupOptions">
        <option value="edit">编辑</option>
        <option class="renameGroup" value="rename">重命名</option>
        <option class="deleteGroup" value="delete">删除</option>
    </select>
    </div>
    </div>
    `
    return e.getElementsByTagName('div')[0]; // 相当于返回上面的字符串（要保证字符串中的顶层元素只有一个）
}