import { ref } from 'vue'

export function useApi() {
    const loading = ref(false)
    const error = ref(null)

    const request = async (url, options = {}) => {
        loading.value = true
        error.value = null
        try {
            const token = localStorage.getItem('apiKey') || ''

            const headers = {
                'Content-Type': 'application/json',
                ...options.headers
            }

            if (token) {
                headers['X-API-Key'] = token
            }

            const res = await fetch(url, { ...options, headers, mode: 'cors' })
            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || `HTTP error! status: ${res.status}`)
            }
            return data
        } catch (err) {
            error.value = err.message
            throw err
        } finally {
            loading.value = false
        }
    }

    const getInfo = () => request('/api/info')
    const getNodes = () => request('/api/nodes')

    // 增加单节点添加
    const addNode = (link) => request('/api/nodes', { method: 'POST', body: JSON.stringify({ link }) })
    const saveLinks = (links) => request('/api/save', { method: 'POST', body: JSON.stringify({ links }) })
    const deleteNode = (index) => request(`/api/nodes?index=${index}`, { method: 'DELETE' })
    const batchDeleteNodes = (indices) => request('/api/nodes/batch-delete', { method: 'POST', body: JSON.stringify({ indices }) })
    const clearNodes = () => request('/api/links', { method: 'DELETE' })

    const getHistory = () => request('/api/history')
    const clearHistory = () => request('/api/history', { method: 'DELETE' })

    const getSubscriptionConfig = () => request('/api/subscription')
    const saveSubscriptionConfig = (config) => request('/api/subscription', { method: 'POST', body: JSON.stringify(config) })
    const resetTraffic = () => request('/api/subscription/reset-traffic', { method: 'POST' })

    const setApiKey = (key) => {
        if (key) {
            localStorage.setItem('apiKey', key)
        } else {
            localStorage.removeItem('apiKey')
        }
    }

    const getApiKey = () => localStorage.getItem('apiKey') || ''

    return {
        loading,
        error,
        getInfo,
        getNodes,
        addNode,
        saveLinks,
        deleteNode,
        batchDeleteNodes,
        clearNodes,
        getHistory,
        clearHistory,
        getSubscriptionConfig,
        saveSubscriptionConfig,
        resetTraffic,
        setApiKey,
        getApiKey
    }
}
