import type { ProFormInstance } from '@ant-design/pro-components';
import { ModalForm, ProFormText, ProFormSelect, ProFormDigit, ProFormDateTimePicker } from '@ant-design/pro-components';
import { message } from 'antd';
import React, { useRef } from 'react';
import { updateUser } from '@/services/users';
import type { UserItem } from '../index';

type UpdateFormProps = {
  onOk?: () => void;
  trigger: React.ReactElement;
  values: UserItem;
};

const UpdateForm: React.FC<UpdateFormProps> = ({ onOk, trigger, values }) => {
  const formRef = useRef<ProFormInstance>();
  const [messageApi, contextHolder] = message.useMessage();

  const handleSubmit = async (formValues: any) => {
    try {
      // 移除不需要更新的字段
      const { id, userId, createdAt, updatedAt, ...updateData } = formValues;

      await updateUser(values.id, updateData);
      messageApi.success('更新用户成功');
      onOk?.();
      return true;
    } catch (error) {
      messageApi.error('更新用户失败');
      return false;
    }
  };

  const getInitialValues = () => {
    return {
      username: values.username,
      email: values.email,
      role: values.role,
      level: values.level,
      credits: values.credits,
      balance: values.balance,
      avatarUrl: values.avatar,
      membershipExpiry: values.membershipExpiry ? new Date(values.membershipExpiry) : undefined,
    };
  };

  return (
    <ModalForm
      title="编辑用户"
      trigger={trigger}
      formRef={formRef}
      autoFocusFirstInput={false}
      modalProps={{
        destroyOnHidden: true,
      }}
      submitTimeout={2000}
      onFinish={handleSubmit}
      width={600}
      initialValues={getInitialValues()}
    >
      {contextHolder}

      <ProFormText
        name="username"
        label="用户名"
        placeholder="请输入用户名"
        rules={[
          { required: true, message: '用户名是必填项' },
          { min: 3, message: '用户名至少3个字符' },
          { max: 50, message: '用户名不能超过50个字符' },
        ]}
      />

      <ProFormText
        name="email"
        label="邮箱"
        placeholder="请输入邮箱"
        rules={[
          { required: true, message: '邮箱是必填项' },
          { type: 'email', message: '请输入有效的邮箱地址' },
        ]}
      />

      <ProFormText.Password
        name="password"
        label="新密码"
        placeholder="留空表示不修改密码"
        rules={[
          { min: 6, message: '密码至少6个字符' },
        ]}
      />

      <ProFormSelect
        name="role"
        label="角色"
        valueEnum={{
          normal: '普通用户',
          admin: '管理员',
        }}
        rules={[{ required: true, message: '请选择角色' }]}
      />

      <ProFormSelect
        name="level"
        label="等级"
        valueEnum={{
          free: '免费版',
          lite: '轻量版',
          pro: '专业版',
        }}
        rules={[{ required: true, message: '请选择等级' }]}
      />

      <ProFormDigit
        name="credits"
        label="积分"
        min={0}
        max={999999}
        fieldProps={{
          precision: 0,
        }}
      />

      <ProFormDigit
        name="balance"
        label="余额"
        min={0}
        max={999999}
        fieldProps={{
          precision: 2,
          addonBefore: '$',
        }}
      />

      <ProFormText
        name="avatarUrl"
        label="头像URL"
        placeholder="请输入头像URL"
      />

      <ProFormDateTimePicker
        name="membershipExpiry"
        label="会员到期时间"
        placeholder="请选择会员到期时间"
      />
    </ModalForm>
  );
};

export default UpdateForm;