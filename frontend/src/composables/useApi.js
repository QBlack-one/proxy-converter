import { ref } from 'vue'

// In a real generic app, you'd use axios or similar. We'll use fetch here.
export function useApi() {
    const loading = ref(false)
    const error = ref(null)

    const request = async (url, options = {}) => {
        loading.value = true
        error.value = null
        try {
            // In dev mode, Vite proxies /api to localhost:3000 (handled via vite.config.js)
            // In prod mode, they are on the same domain
            const token = localStorage.getItem('proxyApiKey') || ''

            const headers = {
                'Content-Type': 'application/json',
                ...options.headers
            }

            if (token) {
                headers['Authorization'] = `Bearer ${token}`
            }

            const res = await fetch(url, { ...options, headers })
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
    const saveLinks = (links) => request('/api/save', { method: 'POST', body: JSON.stringify({ links }) })
    const deleteNode = (index) => request(`/api/nodes?index=${index}`, { method: 'DELETE' })
    const clearNodes = () => request('/api/links', { method: 'DELETE' })
    const getHistory = () => request('/api/history')
    const clearHistory = () => request('/api/history', { method: 'DELETE' })

    return {
        loading,
        error,
        getInfo,
        getNodes,
        saveLinks,
        deleteNode,
        clearNodes,
        getHistory,
        clearHistory
    }
}
