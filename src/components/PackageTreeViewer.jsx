import { Input, Icon } from 'antd';
import React from 'react';
import _ from 'lodash';

const Search = Input.Search;

const parsePlainStringToTree = (packageStrList) => {
  const parsedObj = {};
  packageStrList.forEach((ctxStr) => {
    const splitCtx = ctxStr.split('.');
    let dataCur = parsedObj;
    splitCtx.forEach((part) => {
      if (!(part in dataCur)) {
        dataCur[part] = {};
      }
      dataCur = dataCur[part];
    });
  });
  return parsedObj;
};

const generateTree = (data, path = '') => {
  const children = [];
  Object.entries(data).map(([k, v]) => {
    const key = path ? `${path}.${k}` : k;
    const index = key.lastIndexOf('.');
    const name = key.substr(index + 1, key.length);
    if (Object.keys(v).length > 0) {
      children.push({ key, title: name, children: generateTree(v, key), parent: path });
    } else {
      children.push({ key, title: name, parent: path });
    }
  });
  return children;
};

const dataList = [];
const generateList = (data) => {
  for (let i = 0; i < data.length; i += 1) {
    const node = data[i];
    const key = node.key;
    const parent = node.parent;
    dataList.push({ key, title: key, parent });
    if (node.children) {
      generateList(node.children, node.key);
    }
  }
};

const getChildrenKeys = (key, list) => {
  const children = [];
  for (let i = 0; i < list.length; i += 1) {
    const node = list[i];
    if (node.parent === key) {
      children.push(node.key);
    }
  }
  return children;
};

const getAllParentKeys = (key, currentKeys) => {
  let result = currentKeys;
  if (key.lastIndexOf('.') > -1) {
    const newKey = key.substr(0, key.lastIndexOf('.'));
    if (currentKeys.indexOf(newKey) === -1) {
      result = currentKeys.concat(newKey);
    }
    return Array.from(new Set([...result,
      ...getAllParentKeys(newKey, result)]));
  }
  return Array.from(new Set(result));
};

const getAllChildrenKey = (item) => {
  const result = [];
  const g = (data) => {
    for (let i = 0; i < data.length; i += 1) {
      const kv = data[i];
      if (kv.children) {
        g(kv.children);
      } else {
        result.push(kv.key);
      }
    }
  };

  g(item);
  return result;
};

const filterKeys = (keysRaw, dataRaw, listRaw) => {
  const deleteKeys = [];
  const f = (keys, data, list) => {
    const cycle = Array.from(new Set(data));
    const base = Array.from(new Set(data));
    for (let j = 0; j < keys.length; j += 1) {
      const parentKey = keys[j];
      const children = getChildrenKeys(parentKey, list);
      let flag = false;
      for (let i = 0; i < children.length; i += 1) {
        if (data.indexOf(children[i]) === -1) {
          flag = true;
        }
      }
      if (!flag) {
        if (deleteKeys.indexOf(parentKey) === -1) {
          deleteKeys.push(parentKey);
        }
        if (cycle.indexOf(parentKey) === -1) {
          cycle.push(parentKey);
        }
      }
    }
    if (cycle.length !== base.length) {
      return [deleteKeys, ...f(keys, cycle, list)];
    }
    return deleteKeys;
  };

  f(keysRaw, dataRaw, listRaw);
  return deleteKeys;
};

const generateHalfChecked = (dataRaw, listRaw) => {
  const halfChecked = [];
  const g = (data, list) => {
    let allKeys = [];
    for (let i = 0; i < data.length; i += 1) {
      allKeys = [...getAllParentKeys(data[i], allKeys)];
    }
    const deleteKeys = filterKeys(allKeys, data, list);
    for (let i = 0; i < allKeys.length; i += 1) {
      const halfKey = allKeys[i];
      if (deleteKeys.indexOf(halfKey) > -1) {
        halfChecked.push(`ACK-${halfKey}`);
      } else {
        halfChecked.push(halfKey);
      }
    }
  };

  g(dataRaw, listRaw);
  return halfChecked;
};

export default class PackageTreeViewer extends React.Component {
  customizedPackageInput;

  state = {
    expandedKeys: [],
    searchValue: '',
    gData: [],
    checkBox: [],
  }

  onCheckBox = (item, onCheck) => {
    this.setState((prevState) => {
      const checkBox = prevState.checkBox;
      const root = [];
      root.push(item);
      const needKeys = getAllChildrenKey(root);
      for (let i = 0; i < needKeys.length; i += 1) {
        const nk = needKeys[i];
        if (checkBox.indexOf(nk) === -1) {
          checkBox.push(nk);
        } else {
          for (let j = 0; j < checkBox.length; j += 1) {
            if (checkBox[j] === nk) {
              checkBox.splice(j, 1);
            }
          }
        }
      }
      if (onCheck) {
        onCheck(checkBox);
      }
      return {
        checkBox,
      };
    });
  }

  onClickArrow = (item) => {
    this.setState((prevState) => {
      const key = item.key;
      const expandedKeys = prevState.expandedKeys;
      if (expandedKeys.indexOf(key) === -1) {
        return { expandedKeys: expandedKeys.concat(key) };
      }
      for (let i = expandedKeys.length - 1; i >= 0; i -= 1) {
        if (expandedKeys[i] === key) {
          expandedKeys.splice(i, 1);
        }
      }
      return {
        expandedKeys,
      };
    });
  }

  constructor() {
    super();
    this.doSearch = _.debounce(this.doSearch, 500);
  }

  onChange = (e) => {
    e.persist();
    const value = e.target.value;
    this.doSearch(value);
  }

  doSearch = (value) => {
    let expandedKeys = dataList.map((item) => {
      if (item.title.indexOf(value) > -1) {
        return item.parent;
      }
      return null;
    }).filter((item, i, self) => item && self.indexOf(item) === i);

    for (let i = 0; i < expandedKeys.length; i += 1) {
      expandedKeys = getAllParentKeys(expandedKeys[i], expandedKeys);
    }
    this.setState({
      expandedKeys,
      searchValue: value,
    });
  }

  render() {
    const {
      searchValue,
      expandedKeys,
      gData,
      checkBox,
    } = this.state;

    const {
      packages,
      onCheck,
      checkable,
    } = this.props;

    const parsedPackages = parsePlainStringToTree(packages);
    this.state.gData = generateTree(parsedPackages);
    dataList.length = 0;
    generateList(gData);
    const halfChecked = generateHalfChecked(checkBox, dataList);
    const loop = data => data.map((item) => {
      const index = item.title.indexOf(searchValue);
      const beforeStr = item.title.substr(0, index);
      const afterStr = item.title.substr(index + searchValue.length);
      const arrowClass = expandedKeys.indexOf(item.key) > -1 ? 'caret-down' : 'caret-right';
      const leafBox = checkBox.indexOf(item.key) > -1 ? 'ant-tree-checkbox ant-tree-checkbox-checked' : 'ant-tree-checkbox';
      let rootBox = 'ant-tree-checkbox';
      if (halfChecked.indexOf(`ACK-${item.key}`) > -1) {
        rootBox = 'ant-tree-checkbox ant-tree-checkbox-checked';
      } else if (halfChecked.indexOf(item.key) > -1) {
        rootBox = 'ant-tree-checkbox ant-tree-checkbox-indeterminate';
      }
      const title = index > -1 ? (
        <span>
          {beforeStr}
          <span style={{ color: '#f50' }}>{searchValue}</span>
          {afterStr}
        </span>
      ) : <span>{item.title}</span>;
      if (item.children) {
        return (
          <ul className="ant-tree ant-tree-icon-hide" role="tree">
            <li className="ant-tree-treenode-switcher" role="treeitem">
              <span className="ant-tree-switcher" onClick={this.onClickArrow.bind(this, item)}>
                <Icon type={arrowClass} />
              </span>
              {checkable && (
                <span className={rootBox} onClick={this.onCheckBox.bind(this, item, onCheck)}>
                  <span className="ant-tree-checkbox-inner" />
                </span>
              )}
              <span className="ant-tree-node-content-wrapper ant-tree-node-content-wrapper-close">
                {title}
              </span>
              { (expandedKeys.indexOf(item.key) > -1) && loop(item.children) }
            </li>
          </ul>
        );
      }
      return (
        <ul>
          <li className="ant-tree-treenode-switcher-close" role="treeitem">
            <span className="ant-tree-switcher ant-tree-switcher-noop" />
            {checkable && (
              <span className={leafBox} onClick={this.onCheckBox.bind(this, item, onCheck)}>
                <span className="ant-tree-checkbox-inner" />
              </span>
            )}
            <span className="ant-tree-node-content-wrapper ant-tree-node-content-wrapper-close">
              {title}
            </span>
          </li>
        </ul>
      );
    });
    return (
      <div>
        <Search style={{ marginBottom: 8 }} placeholder="Search for Compute Context" onChange={this.onChange} />
        { loop(this.state.gData) }
      </div>
    );
  }
}
