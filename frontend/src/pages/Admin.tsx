import React, { useEffect, useState } from 'react';
import { adminApi, type User, type InviteCode } from '../api/client';
import { alert } from '../components/Dialog';

const Admin: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [invites, setInvites] = useState<InviteCode[]>([]);
  const [activeTab, setActiveTab] = useState<'users' | 'invites'>('invites');

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      if (activeTab === 'users') {
        const res = await adminApi.getUsers();
        setUsers(res.data);
      } else {
        const res = await adminApi.getInvites();
        setInvites(res.data);
      }
    } catch (err) {
      // alert('加载失败 (可能没有权限)');
      console.error(err);
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('确定删除该用户吗？')) return;
    try {
      await adminApi.deleteUser(id);
      fetchData();
    } catch (err) {
      alert('删除失败');
    }
  };

  const handleGenerateInvite = async () => {
    try {
      await adminApi.generateInvite();
      fetchData();
    } catch (err) {
      alert('生成失败');
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">管理员后台</h1>
      
      <div className="flex space-x-4 mb-4">
        <button
          className={`px-4 py-2 rounded ${activeTab === 'invites' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setActiveTab('invites')}
        >
          邀请码管理
        </button>
        <button
          className={`px-4 py-2 rounded ${activeTab === 'users' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setActiveTab('users')}
        >
          用户管理
        </button>
      </div>

      {activeTab === 'invites' && (
        <div>
          <button
            onClick={handleGenerateInvite}
            className="mb-4 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            生成新邀请码
          </button>
          <div className="bg-white shadow rounded overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">邀请码</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invites.map((invite) => (
                  <tr key={invite.id}>
                    <td className="px-6 py-4 whitespace-nowrap">{invite.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono">{invite.code}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {invite.is_used ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          已使用
                        </span>
                      ) : (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          未使用
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white shadow rounded overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户名</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">管理员</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">注册时间</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap">{user.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{user.username}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{user.is_admin ? '是' : '否'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{new Date(user.created_at).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        {!user.is_admin && (
                            <button
                                onClick={() => handleDeleteUser(user.id)}
                                className="text-red-600 hover:text-red-900"
                            >
                                删除
                            </button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
      )}
    </div>
  );
};

export default Admin;
