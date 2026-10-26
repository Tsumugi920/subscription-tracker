/**
 * REST API 封装：所有前端模块统一通过这里访问后端。
 */

const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let message = `请求失败（HTTP ${res.status}）`;
    try {
      const body = await res.json();
      if (body && body.error) message = body.error;
    } catch { /* 非 JSON 响应，保留默认错误信息 */ }
    throw new Error(message);
  }
  return res.json();
}

function qs(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  }
  const str = search.toString();
  return str ? `?${str}` : '';
}

export const api = {
  // 订阅 CRUD
  listSubs: (params = {}) => request(`/subs${qs(params)}`),
  getSub: (id) => request(`/subs/${id}`),
  createSub: (body) => request('/subs', { method: 'POST', body: JSON.stringify(body) }),
  updateSub: (id, body) => request(`/subs/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  cancelSub: (id) => request(`/subs/${id}/cancel`, { method: 'POST', body: '{}' }),
  restoreSub: (id) => request(`/subs/${id}/restore`, { method: 'POST', body: '{}' }),
  deleteSub: (id) => request(`/subs/${id}`, { method: 'DELETE' }),

  // 续费提醒
  getReminders: (days = 30) => request(`/reminders${qs({ days })}`),

  // 统计
  getStatsSummary: () => request('/stats/summary'),
  getStatsTrend: (months = 6) => request(`/stats/trend${qs({ months })}`),
};
