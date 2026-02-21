/**
 * 代理订阅转换器 - YAML 序列化模块 (v3 - flow-style)
 * 
 * 核心改动：
 *   - 新增 flowObj() / flowVal() 生成行内 flow-style YAML
 *   - generateClashConfig 对标参考配置格式
 *   - proxies / proxy-groups / rules 使用 flow-style 单行输出
 */

// ==================== Flow-Style YAML ====================

/**
 * 将 JS 对象序列化为 flow-style YAML: { key: val, key2: val2 }
 */
function flowObj(obj) {
    if (obj === null || obj === undefined) return 'null';
    if (typeof obj !== 'object') return flowVal(obj);
    if (Array.isArray(obj)) {
        return '[' + obj.map(function (v) { return flowVal(v); }).join(', ') + ']';
    }
    var parts = [];
    var keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        var v = obj[k];
        if (v === undefined || v === null) continue;
        parts.push(flowKey(k) + ': ' + flowVal(v));
    }
    return '{ ' + parts.join(', ') + ' }';
}

/**
 * flow-style 值序列化
 */
function flowVal(val) {
    if (val === null || val === undefined) return 'null';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'string') {
        // 需要引号的情况
        if (val === '' || val === 'true' || val === 'false' || val === 'null' ||
            /^\d[\d.eE+\-]*$/.test(val) ||
            /[:{}\[\],&*?|>!'"%@`\n]/.test(val)) {
            return "'" + val.replace(/'/g, "''") + "'";
        }
        return val;
    }
    if (Array.isArray(val)) {
        return '[' + val.map(function (v) { return flowVal(v); }).join(', ') + ']';
    }
    if (typeof val === 'object') {
        return flowObj(val);
    }
    return String(val);
}

/**
 * flow-style key 序列化
 */
function flowKey(key) {
    if (/[:{}\[\],&*?|>!'"%@`]/.test(key) || key === '') {
        return "'" + key.replace(/'/g, "''") + "'";
    }
    return key;
}

// ==================== Block-Style YAML (保留给 toYaml) ====================

function toYaml(obj, indent) {
    if (indent === undefined) indent = 0;
    var pad = repeat('  ', indent);
    var lines = [];

    if (Array.isArray(obj)) {
        for (var i = 0; i < obj.length; i++) {
            var item = obj[i];
            if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
                var keys = Object.keys(item);
                var isFirst = true;
                for (var k = 0; k < keys.length; k++) {
                    var key = keys[k];
                    var val = item[key];
                    if (val === undefined || val === null) continue;
                    var prefix = isFirst ? (pad + '- ') : (pad + '  ');
                    isFirst = false;
                    appendKV(lines, prefix, key, val, indent + 1);
                }
            } else {
                lines.push(pad + '- ' + scalar(item));
            }
        }
    } else if (obj !== null && typeof obj === 'object') {
        var entries = Object.keys(obj);
        for (var j = 0; j < entries.length; j++) {
            var eKey = entries[j];
            var eVal = obj[eKey];
            if (eVal === undefined || eVal === null) continue;
            appendKV(lines, pad, eKey, eVal, indent);
        }
    }

    return lines.join('\n') + '\n';
}

function appendKV(lines, prefix, key, val, indent) {
    var qk = quoteKey(key);

    if (Array.isArray(val)) {
        if (val.length === 0) {
            lines.push(prefix + qk + ': []');
        } else if (val.every(function (v) { return typeof v !== 'object' || v === null; })) {
            lines.push(prefix + qk + ':');
            var childPad = repeat('  ', indent + 1);
            for (var i = 0; i < val.length; i++) {
                lines.push(childPad + '- ' + scalar(val[i]));
            }
        } else {
            lines.push(prefix + qk + ':');
            pushChildLines(lines, toYaml(val, indent + 1));
        }
    } else if (val !== null && typeof val === 'object') {
        lines.push(prefix + qk + ':');
        pushChildLines(lines, toYaml(val, indent + 1));
    } else {
        lines.push(prefix + qk + ': ' + scalar(val));
    }
}

function pushChildLines(lines, yamlStr) {
    var parts = yamlStr.replace(/\n$/, '').split('\n');
    for (var i = 0; i < parts.length; i++) {
        lines.push(parts[i]);
    }
}

function quoteKey(key) {
    if (/[:\-#{}\[\],&*?|>!'"%@`]/.test(key) || key.indexOf(' ') >= 0 || key === '') {
        return "'" + key.replace(/'/g, "''") + "'";
    }
    return key;
}

function scalar(val) {
    if (val === null || val === undefined) return 'null';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'string') {
        if (val === '' ||
            val === 'true' || val === 'false' || val === 'null' ||
            /^\d[\d.eE+\-]*$/.test(val) ||
            /[:\-#{}\[\],&*?|>!'"%@`\n\/ ]/.test(val)) {
            return "'" + val.replace(/'/g, "''") + "'";
        }
        return val;
    }
    return String(val);
}

function repeat(str, n) {
    var r = '';
    for (var i = 0; i < n; i++) r += str;
    return r;
}

// ==================== Clash 配置生成 ====================

/**
 * 生成 Clash 配置 - 对标参考配置格式
 * 输出 flow-style YAML，与主流订阅转换器一致
 */
function generateClashConfig(proxies, options) {
    if (!options) options = {};
    var mixedPort = options.httpPort || 7890;
    var allowLan = options.allowLan !== false;
    var mode = options.mode || 'rule';
    var logLevel = options.logLevel || 'info';
    var enableDns = options.enableDns !== false;
    var testUrl = options.testUrl || 'http://www.gstatic.com/generate_204';
    var testInterval = options.testInterval || 300;

    var proxyNames = proxies.map(function (p) { return p.name; });

    // 分组名：用第一个有意义的节点名推断，否则用默认
    var groupName = '🚀 节点选择';

    var lines = [];

    // ===== 基础配置 =====
    var title = 'xinghe';
    lines.push('name: ' + '"' + title + '"');
    lines.push('profile-name: ' + '"' + title + '"');
    lines.push('mixed-port: ' + mixedPort);
    lines.push("allow-lan: " + allowLan);
    lines.push("bind-address: '*'");
    lines.push('mode: ' + mode);
    lines.push('log-level: ' + logLevel);
    lines.push("external-controller: '127.0.0.1:9090'");
    lines.push('unified-delay: true');
    lines.push('tcp-concurrent: true');

    // ===== DNS =====
    if (enableDns) {
        lines.push('dns:');
        lines.push('    enable: true');
        lines.push('    ipv6: false');
        lines.push('    default-nameserver: [223.5.5.5, 119.29.29.29, 114.114.114.114]');
        lines.push('    enhanced-mode: fake-ip');
        lines.push('    fake-ip-range: 198.18.0.1/16');
        lines.push('    use-hosts: true');
        lines.push('    respect-rules: true');
        lines.push("    proxy-server-nameserver: [223.5.5.5, 119.29.29.29, 114.114.114.114]");
        lines.push("    nameserver: [223.5.5.5, 119.29.29.29, 114.114.114.114]");
        lines.push("    fallback: [1.1.1.1, 8.8.8.8]");
        lines.push("    fallback-filter: { geoip: true, geoip-code: CN, geosite: [gfw], ipcidr: [240.0.0.0/4], domain: [+.google.com, +.facebook.com, +.youtube.com] }");
    }

    // ===== Proxies (flow-style) =====
    lines.push('proxies:');
    for (var i = 0; i < proxies.length; i++) {
        lines.push('    - ' + flowObj(proxies[i]));
    }

    // ===== Proxy Groups (flow-style) =====
    var autoGroup = { name: '自动选择', type: 'url-test', proxies: proxyNames, url: testUrl, interval: 86400 };
    var fallbackGroup = { name: '故障转移', type: 'fallback', proxies: proxyNames, url: testUrl, interval: 7200 };
    var selectGroup = { name: groupName, type: 'select', proxies: ['自动选择', '故障转移'].concat(proxyNames) };

    lines.push('proxy-groups:');
    lines.push('    - ' + flowObj(selectGroup));
    lines.push('    - ' + flowObj(autoGroup));
    lines.push('    - ' + flowObj(fallbackGroup));

    // ===== Rules =====
    lines.push('rules:');
    var rules = getClashRules(groupName);
    for (var r = 0; r < rules.length; r++) {
        lines.push("    - '" + rules[r] + "'");
    }

    return lines.join('\n') + '\n';
}

/**
 * 完整的 Clash 分流规则（参考赔钱.yaml / free.yaml / sj.yaml）
 */
function getClashRules(proxyGroup) {
    var P = proxyGroup;
    return [
        // Google DNS 直连到代理
        'IP-CIDR,1.1.1.1/32,' + P + ',no-resolve',
        'IP-CIDR,8.8.8.8/32,' + P + ',no-resolve',
        'DOMAIN-SUFFIX,services.googleapis.cn,' + P,
        'DOMAIN-SUFFIX,xn--ngstr-lra8j.com,' + P,
        // 安全浏览直连
        'DOMAIN,safebrowsing.urlsec.qq.com,DIRECT',
        'DOMAIN,safebrowsing.googleapis.com,DIRECT',
        // Apple
        'DOMAIN,developer.apple.com,' + P,
        'DOMAIN-SUFFIX,digicert.com,' + P,
        'DOMAIN,ocsp.apple.com,' + P,
        'DOMAIN,ocsp.comodoca.com,' + P,
        'DOMAIN,ocsp.usertrust.com,' + P,
        'DOMAIN,ocsp.sectigo.com,' + P,
        'DOMAIN,ocsp.verisign.net,' + P,
        'DOMAIN-SUFFIX,apple-dns.net,' + P,
        'DOMAIN,testflight.apple.com,' + P,
        'DOMAIN,sandbox.itunes.apple.com,' + P,
        'DOMAIN,itunes.apple.com,' + P,
        'DOMAIN-SUFFIX,apps.apple.com,' + P,
        'DOMAIN-SUFFIX,blobstore.apple.com,' + P,
        'DOMAIN,cvws.icloud-content.com,' + P,
        // Apple 直连
        'DOMAIN-SUFFIX,mzstatic.com,DIRECT',
        'DOMAIN-SUFFIX,itunes.apple.com,DIRECT',
        'DOMAIN-SUFFIX,icloud.com,DIRECT',
        'DOMAIN-SUFFIX,icloud-content.com,DIRECT',
        'DOMAIN-SUFFIX,me.com,DIRECT',
        'DOMAIN-SUFFIX,aaplimg.com,DIRECT',
        'DOMAIN-SUFFIX,cdn20.com,DIRECT',
        'DOMAIN-SUFFIX,cdn-apple.com,DIRECT',
        'DOMAIN-SUFFIX,akadns.net,DIRECT',
        'DOMAIN-SUFFIX,akamaiedge.net,DIRECT',
        'DOMAIN-SUFFIX,edgekey.net,DIRECT',
        'DOMAIN-SUFFIX,mwcloudcdn.com,DIRECT',
        'DOMAIN-SUFFIX,mwcname.com,DIRECT',
        'DOMAIN-SUFFIX,apple.com,DIRECT',
        'DOMAIN-SUFFIX,apple-cloudkit.com,DIRECT',
        'DOMAIN-SUFFIX,apple-mapkit.com,DIRECT',
        // 中国直连
        'DOMAIN,cn.bing.com,DIRECT',
        'DOMAIN-SUFFIX,126.com,DIRECT',
        'DOMAIN-SUFFIX,126.net,DIRECT',
        'DOMAIN-SUFFIX,127.net,DIRECT',
        'DOMAIN-SUFFIX,163.com,DIRECT',
        'DOMAIN-SUFFIX,360buyimg.com,DIRECT',
        'DOMAIN-SUFFIX,36kr.com,DIRECT',
        'DOMAIN-SUFFIX,acfun.tv,DIRECT',
        'DOMAIN-SUFFIX,air-matters.com,DIRECT',
        'DOMAIN-SUFFIX,aixifan.com,DIRECT',
        'DOMAIN-KEYWORD,alicdn,DIRECT',
        'DOMAIN-KEYWORD,alipay,DIRECT',
        'DOMAIN-KEYWORD,taobao,DIRECT',
        'DOMAIN-SUFFIX,amap.com,DIRECT',
        'DOMAIN-SUFFIX,autonavi.com,DIRECT',
        'DOMAIN-KEYWORD,baidu,DIRECT',
        'DOMAIN-SUFFIX,bdimg.com,DIRECT',
        'DOMAIN-SUFFIX,bdstatic.com,DIRECT',
        'DOMAIN-SUFFIX,bilibili.com,DIRECT',
        'DOMAIN-SUFFIX,bilivideo.com,DIRECT',
        'DOMAIN-SUFFIX,caiyunapp.com,DIRECT',
        'DOMAIN-SUFFIX,clouddn.com,DIRECT',
        'DOMAIN-SUFFIX,cnbeta.com,DIRECT',
        'DOMAIN-SUFFIX,cnbetacdn.com,DIRECT',
        'DOMAIN-SUFFIX,cootekservice.com,DIRECT',
        'DOMAIN-SUFFIX,csdn.net,DIRECT',
        'DOMAIN-SUFFIX,ctrip.com,DIRECT',
        'DOMAIN-SUFFIX,dgtle.com,DIRECT',
        'DOMAIN-SUFFIX,dianping.com,DIRECT',
        'DOMAIN-SUFFIX,douban.com,DIRECT',
        'DOMAIN-SUFFIX,doubanio.com,DIRECT',
        'DOMAIN-SUFFIX,duokan.com,DIRECT',
        'DOMAIN-SUFFIX,easou.com,DIRECT',
        'DOMAIN-SUFFIX,ele.me,DIRECT',
        'DOMAIN-SUFFIX,feng.com,DIRECT',
        'DOMAIN-SUFFIX,fir.im,DIRECT',
        'DOMAIN-SUFFIX,frdic.com,DIRECT',
        'DOMAIN-SUFFIX,g-cores.com,DIRECT',
        'DOMAIN-SUFFIX,godic.net,DIRECT',
        'DOMAIN-SUFFIX,gtimg.com,DIRECT',
        'DOMAIN,cdn.hockeyapp.net,DIRECT',
        'DOMAIN-SUFFIX,hongxiu.com,DIRECT',
        'DOMAIN-SUFFIX,hxcdn.net,DIRECT',
        'DOMAIN-SUFFIX,iciba.com,DIRECT',
        'DOMAIN-SUFFIX,ifeng.com,DIRECT',
        'DOMAIN-SUFFIX,ifengimg.com,DIRECT',
        'DOMAIN-SUFFIX,ipip.net,DIRECT',
        'DOMAIN-SUFFIX,iqiyi.com,DIRECT',
        'DOMAIN-SUFFIX,jd.com,DIRECT',
        'DOMAIN-SUFFIX,jianshu.com,DIRECT',
        'DOMAIN-SUFFIX,knewone.com,DIRECT',
        'DOMAIN-SUFFIX,le.com,DIRECT',
        'DOMAIN-SUFFIX,lecloud.com,DIRECT',
        'DOMAIN-SUFFIX,lemicp.com,DIRECT',
        'DOMAIN-SUFFIX,licdn.com,DIRECT',
        'DOMAIN-SUFFIX,luoo.net,DIRECT',
        'DOMAIN-SUFFIX,meituan.com,DIRECT',
        'DOMAIN-SUFFIX,meituan.net,DIRECT',
        'DOMAIN-SUFFIX,mi.com,DIRECT',
        'DOMAIN-SUFFIX,miaopai.com,DIRECT',
        'DOMAIN-SUFFIX,microsoft.com,DIRECT',
        'DOMAIN-SUFFIX,microsoftonline.com,DIRECT',
        'DOMAIN-SUFFIX,miui.com,DIRECT',
        'DOMAIN-SUFFIX,miwifi.com,DIRECT',
        'DOMAIN-SUFFIX,mob.com,DIRECT',
        'DOMAIN-SUFFIX,netease.com,DIRECT',
        'DOMAIN-SUFFIX,office.com,DIRECT',
        'DOMAIN-SUFFIX,office365.com,DIRECT',
        'DOMAIN-KEYWORD,officecdn,DIRECT',
        'DOMAIN-SUFFIX,oschina.net,DIRECT',
        'DOMAIN-SUFFIX,ppsimg.com,DIRECT',
        'DOMAIN-SUFFIX,pstatp.com,DIRECT',
        'DOMAIN-SUFFIX,qcloud.com,DIRECT',
        'DOMAIN-SUFFIX,qdaily.com,DIRECT',
        'DOMAIN-SUFFIX,qdmm.com,DIRECT',
        'DOMAIN-SUFFIX,qhimg.com,DIRECT',
        'DOMAIN-SUFFIX,qhres.com,DIRECT',
        'DOMAIN-SUFFIX,qidian.com,DIRECT',
        'DOMAIN-SUFFIX,qihucdn.com,DIRECT',
        'DOMAIN-SUFFIX,qiniu.com,DIRECT',
        'DOMAIN-SUFFIX,qiniucdn.com,DIRECT',
        'DOMAIN-SUFFIX,qiyipic.com,DIRECT',
        'DOMAIN-SUFFIX,qq.com,DIRECT',
        'DOMAIN-SUFFIX,qqurl.com,DIRECT',
        'DOMAIN-SUFFIX,rarbg.to,DIRECT',
        'DOMAIN-SUFFIX,ruguoapp.com,DIRECT',
        'DOMAIN-SUFFIX,segmentfault.com,DIRECT',
        'DOMAIN-SUFFIX,sinaapp.com,DIRECT',
        'DOMAIN-SUFFIX,smzdm.com,DIRECT',
        'DOMAIN-SUFFIX,snapdrop.net,DIRECT',
        'DOMAIN-SUFFIX,sogou.com,DIRECT',
        'DOMAIN-SUFFIX,sogoucdn.com,DIRECT',
        'DOMAIN-SUFFIX,sohu.com,DIRECT',
        'DOMAIN-SUFFIX,soku.com,DIRECT',
        'DOMAIN-SUFFIX,speedtest.net,DIRECT',
        'DOMAIN-SUFFIX,sspai.com,DIRECT',
        'DOMAIN-SUFFIX,suning.com,DIRECT',
        'DOMAIN-SUFFIX,taobao.com,DIRECT',
        'DOMAIN-SUFFIX,tencent.com,DIRECT',
        'DOMAIN-SUFFIX,tenpay.com,DIRECT',
        'DOMAIN-SUFFIX,tianyancha.com,DIRECT',
        'DOMAIN-SUFFIX,tmall.com,DIRECT',
        'DOMAIN-SUFFIX,tudou.com,DIRECT',
        'DOMAIN-SUFFIX,umetrip.com,DIRECT',
        'DOMAIN-SUFFIX,upaiyun.com,DIRECT',
        'DOMAIN-SUFFIX,upyun.com,DIRECT',
        'DOMAIN-SUFFIX,veryzhun.com,DIRECT',
        'DOMAIN-SUFFIX,weather.com,DIRECT',
        'DOMAIN-SUFFIX,weibo.com,DIRECT',
        'DOMAIN-SUFFIX,xiami.com,DIRECT',
        'DOMAIN-SUFFIX,xiami.net,DIRECT',
        'DOMAIN-SUFFIX,xiaomicp.com,DIRECT',
        'DOMAIN-SUFFIX,ximalaya.com,DIRECT',
        'DOMAIN-SUFFIX,xmcdn.com,DIRECT',
        'DOMAIN-SUFFIX,xunlei.com,DIRECT',
        'DOMAIN-SUFFIX,yhd.com,DIRECT',
        'DOMAIN-SUFFIX,yihaodianimg.com,DIRECT',
        'DOMAIN-SUFFIX,yinxiang.com,DIRECT',
        'DOMAIN-SUFFIX,ykimg.com,DIRECT',
        'DOMAIN-SUFFIX,youdao.com,DIRECT',
        'DOMAIN-SUFFIX,youku.com,DIRECT',
        'DOMAIN-SUFFIX,zealer.com,DIRECT',
        'DOMAIN-SUFFIX,zhihu.com,DIRECT',
        'DOMAIN-SUFFIX,zhimg.com,DIRECT',
        'DOMAIN-SUFFIX,zimuzu.tv,DIRECT',
        'DOMAIN-SUFFIX,zoho.com,DIRECT',
        // 海外代理
        'DOMAIN-KEYWORD,amazon,' + P,
        'DOMAIN-KEYWORD,google,' + P,
        'DOMAIN-KEYWORD,gmail,' + P,
        'DOMAIN-KEYWORD,youtube,' + P,
        'DOMAIN-KEYWORD,facebook,' + P,
        'DOMAIN-SUFFIX,fb.me,' + P,
        'DOMAIN-SUFFIX,fbcdn.net,' + P,
        'DOMAIN-KEYWORD,twitter,' + P,
        'DOMAIN-KEYWORD,instagram,' + P,
        'DOMAIN-KEYWORD,dropbox,' + P,
        'DOMAIN-SUFFIX,twimg.com,' + P,
        'DOMAIN-KEYWORD,blogspot,' + P,
        'DOMAIN-SUFFIX,youtu.be,' + P,
        'DOMAIN-KEYWORD,whatsapp,' + P,
        // 广告拦截
        'DOMAIN-KEYWORD,admarvel,REJECT',
        'DOMAIN-KEYWORD,admaster,REJECT',
        'DOMAIN-KEYWORD,adsage,REJECT',
        'DOMAIN-KEYWORD,adsmogo,REJECT',
        'DOMAIN-KEYWORD,adsrvmedia,REJECT',
        'DOMAIN-KEYWORD,adwords,REJECT',
        'DOMAIN-KEYWORD,adservice,REJECT',
        'DOMAIN-SUFFIX,appsflyer.com,REJECT',
        'DOMAIN-KEYWORD,domob,REJECT',
        'DOMAIN-SUFFIX,doubleclick.net,REJECT',
        'DOMAIN-KEYWORD,duomeng,REJECT',
        'DOMAIN-KEYWORD,dwtrack,REJECT',
        'DOMAIN-KEYWORD,guanggao,REJECT',
        'DOMAIN-KEYWORD,lianmeng,REJECT',
        'DOMAIN-SUFFIX,mmstat.com,REJECT',
        'DOMAIN-KEYWORD,mopub,REJECT',
        'DOMAIN-KEYWORD,omgmta,REJECT',
        'DOMAIN-KEYWORD,openx,REJECT',
        'DOMAIN-KEYWORD,partnerad,REJECT',
        'DOMAIN-KEYWORD,pingfore,REJECT',
        'DOMAIN-KEYWORD,supersonicads,REJECT',
        'DOMAIN-KEYWORD,uedas,REJECT',
        'DOMAIN-KEYWORD,umeng,REJECT',
        'DOMAIN-KEYWORD,usage,REJECT',
        'DOMAIN-SUFFIX,vungle.com,REJECT',
        'DOMAIN-KEYWORD,wlmonitor,REJECT',
        'DOMAIN-KEYWORD,zjtoolbar,REJECT',
        // 海外常用站点代理
        'DOMAIN-SUFFIX,9to5mac.com,' + P,
        'DOMAIN-SUFFIX,abpchina.org,' + P,
        'DOMAIN-SUFFIX,adblockplus.org,' + P,
        'DOMAIN-SUFFIX,adobe.com,' + P,
        'DOMAIN-SUFFIX,akamaized.net,' + P,
        'DOMAIN-SUFFIX,amplitude.com,' + P,
        'DOMAIN-SUFFIX,ampproject.org,' + P,
        'DOMAIN-SUFFIX,android.com,' + P,
        'DOMAIN-SUFFIX,angularjs.org,' + P,
        'DOMAIN-SUFFIX,apkpure.com,' + P,
        'DOMAIN-SUFFIX,appspot.com,' + P,
        'DOMAIN-SUFFIX,archive.org,' + P,
        'DOMAIN-SUFFIX,awsstatic.com,' + P,
        'DOMAIN-SUFFIX,azureedge.net,' + P,
        'DOMAIN-SUFFIX,bing.com,' + P,
        'DOMAIN-SUFFIX,bit.ly,' + P,
        'DOMAIN-SUFFIX,bitbucket.org,' + P,
        'DOMAIN-SUFFIX,blogger.com,' + P,
        'DOMAIN-SUFFIX,blogspot.com,' + P,
        'DOMAIN-SUFFIX,bloomberg.com,' + P,
        'DOMAIN-SUFFIX,box.com,' + P,
        'DOMAIN-SUFFIX,cloudflare.com,' + P,
        'DOMAIN-SUFFIX,cloudfront.net,' + P,
        'DOMAIN-SUFFIX,cnet.com,' + P,
        'DOMAIN-SUFFIX,cocoapods.org,' + P,
        'DOMAIN-SUFFIX,disqus.com,' + P,
        'DOMAIN-SUFFIX,docker.com,' + P,
        'DOMAIN-SUFFIX,dribbble.com,' + P,
        'DOMAIN-SUFFIX,duckduckgo.com,' + P,
        'DOMAIN-SUFFIX,engadget.com,' + P,
        'DOMAIN-SUFFIX,evernote.com,' + P,
        'DOMAIN-SUFFIX,fast.com,' + P,
        'DOMAIN-SUFFIX,fastly.net,' + P,
        'DOMAIN-SUFFIX,fc2.com,' + P,
        'DOMAIN-SUFFIX,feedburner.com,' + P,
        'DOMAIN-SUFFIX,feedly.com,' + P,
        'DOMAIN-SUFFIX,firebaseio.com,' + P,
        'DOMAIN-SUFFIX,flickr.com,' + P,
        'DOMAIN-SUFFIX,flipboard.com,' + P,
        'DOMAIN-SUFFIX,g.co,' + P,
        'DOMAIN-SUFFIX,ggpht.com,' + P,
        'DOMAIN-SUFFIX,git.io,' + P,
        'DOMAIN-KEYWORD,github,' + P,
        'DOMAIN-SUFFIX,golang.org,' + P,
        'DOMAIN-SUFFIX,goo.gl,' + P,
        'DOMAIN-SUFFIX,gravatar.com,' + P,
        'DOMAIN-SUFFIX,gstatic.com,' + P,
        'DOMAIN-SUFFIX,gvt0.com,' + P,
        'DOMAIN-SUFFIX,hotmail.com,' + P,
        'DOMAIN-SUFFIX,ifixit.com,' + P,
        'DOMAIN-SUFFIX,ifttt.com,' + P,
        'DOMAIN-SUFFIX,imgur.com,' + P,
        'DOMAIN-SUFFIX,live.com,' + P,
        'DOMAIN-SUFFIX,live.net,' + P,
        'DOMAIN-SUFFIX,linkedin.com,' + P,
        'DOMAIN-SUFFIX,medium.com,' + P,
        'DOMAIN-SUFFIX,mega.nz,' + P,
        'DOMAIN-SUFFIX,nyt.com,' + P,
        'DOMAIN-SUFFIX,nytimes.com,' + P,
        'DOMAIN-SUFFIX,onedrive.com,' + P,
        'DOMAIN-SUFFIX,outlook.com,' + P,
        'DOMAIN-SUFFIX,pinterest.com,' + P,
        'DOMAIN-SUFFIX,pixiv.net,' + P,
        'DOMAIN-SUFFIX,playstation.com,' + P,
        'DOMAIN-SUFFIX,shadowsocks.org,' + P,
        'DOMAIN-SUFFIX,skype.com,' + P,
        'DOMAIN-SUFFIX,sony.com,' + P,
        'DOMAIN-SUFFIX,soundcloud.com,' + P,
        'DOMAIN-SUFFIX,sourceforge.net,' + P,
        'DOMAIN-SUFFIX,spotify.com,' + P,
        'DOMAIN-SUFFIX,stackoverflow.com,' + P,
        'DOMAIN-SUFFIX,steamcommunity.com,' + P,
        'DOMAIN-SUFFIX,techcrunch.com,' + P,
        'DOMAIN-SUFFIX,theverge.com,' + P,
        'DOMAIN-SUFFIX,todoist.com,' + P,
        'DOMAIN-SUFFIX,trello.com,' + P,
        'DOMAIN-SUFFIX,tumblr.com,' + P,
        'DOMAIN-SUFFIX,twitch.tv,' + P,
        'DOMAIN-SUFFIX,v2ex.com,' + P,
        'DOMAIN-SUFFIX,vimeo.com,' + P,
        'DOMAIN-SUFFIX,vultr.com,' + P,
        'DOMAIN-SUFFIX,wikipedia.org,' + P,
        'DOMAIN-SUFFIX,windows.com,' + P,
        'DOMAIN-SUFFIX,windows.net,' + P,
        'DOMAIN-SUFFIX,wordpress.com,' + P,
        'DOMAIN-SUFFIX,wsj.com,' + P,
        'DOMAIN-SUFFIX,yahoo.com,' + P,
        'DOMAIN-SUFFIX,ytimg.com,' + P,
        'DOMAIN-SUFFIX,telegra.ph,' + P,
        'DOMAIN-SUFFIX,telegram.org,' + P,
        // Telegram IP 段
        'IP-CIDR,91.108.4.0/22,' + P + ',no-resolve',
        'IP-CIDR,91.108.8.0/21,' + P + ',no-resolve',
        'IP-CIDR,91.108.16.0/22,' + P + ',no-resolve',
        'IP-CIDR,91.108.56.0/22,' + P + ',no-resolve',
        'IP-CIDR,149.154.160.0/20,' + P + ',no-resolve',
        'IP-CIDR6,2001:67c:4e8::/48,' + P + ',no-resolve',
        'IP-CIDR6,2001:b28:f23d::/48,' + P + ',no-resolve',
        'IP-CIDR6,2001:b28:f23f::/48,' + P + ',no-resolve',
        // Google 中国 IP
        'IP-CIDR,120.232.181.162/32,' + P + ',no-resolve',
        'IP-CIDR,120.241.147.226/32,' + P + ',no-resolve',
        'IP-CIDR,120.253.253.226/32,' + P + ',no-resolve',
        'IP-CIDR,120.253.255.162/32,' + P + ',no-resolve',
        'IP-CIDR,120.253.255.34/32,' + P + ',no-resolve',
        'IP-CIDR,120.253.255.98/32,' + P + ',no-resolve',
        'IP-CIDR,180.163.150.162/32,' + P + ',no-resolve',
        'IP-CIDR,180.163.150.34/32,' + P + ',no-resolve',
        'IP-CIDR,180.163.151.162/32,' + P + ',no-resolve',
        'IP-CIDR,180.163.151.34/32,' + P + ',no-resolve',
        'IP-CIDR,203.208.39.0/24,' + P + ',no-resolve',
        'IP-CIDR,203.208.40.0/24,' + P + ',no-resolve',
        'IP-CIDR,203.208.41.0/24,' + P + ',no-resolve',
        'IP-CIDR,203.208.43.0/24,' + P + ',no-resolve',
        'IP-CIDR,203.208.50.0/24,' + P + ',no-resolve',
        'IP-CIDR,220.181.174.162/32,' + P + ',no-resolve',
        'IP-CIDR,220.181.174.226/32,' + P + ',no-resolve',
        'IP-CIDR,220.181.174.34/32,' + P + ',no-resolve',
        // 本地直连
        'DOMAIN,injections.adguard.org,DIRECT',
        'DOMAIN,local.adguard.org,DIRECT',
        'DOMAIN-SUFFIX,local,DIRECT',
        'IP-CIDR,127.0.0.0/8,DIRECT',
        'IP-CIDR,172.16.0.0/12,DIRECT',
        'IP-CIDR,192.168.0.0/16,DIRECT',
        'IP-CIDR,10.0.0.0/8,DIRECT',
        'IP-CIDR,17.0.0.0/8,DIRECT',
        'IP-CIDR,100.64.0.0/10,DIRECT',
        'IP-CIDR,224.0.0.0/4,DIRECT',
        'IP-CIDR6,fe80::/10,DIRECT',
        // 中国域名和 IP 直连
        'DOMAIN-SUFFIX,cn,DIRECT',
        'DOMAIN-KEYWORD,-cn,DIRECT',
        'GEOIP,CN,DIRECT',
        // 兜底
        'MATCH,' + P
    ];
}
