import { PlusOutlined } from '@ant-design/icons';
import type { ProFormInstance } from '@ant-design/pro-components';
import { ModalForm, ProFormText, ProFormSelect, ProFormDigit } from '@ant-design/pro-components';
import { Button, message } from 'antd';
import React, { useRef } from 'react';
import { addUser } from '@/services/users';

type CreateFormProps = {
  reload?: () => void;
};

const CreateForm: React.FC<CreateFormProps> = ({ reload }) => {
  const formRef = useRef<ProFormInstance>();
  const [messageApi, contextHolder] = message.useMessage();

  const handleSubmit = async (values: any) => {
    try {
      await addUser(values);
      messageApi.success('新增用户成功');
      formRef.current?.resetFields();
      reload?.();
      return true;
    } catch (error) {
      messageApi.error('新增用户失败');
      return false;
    }
  };

  return (
    <ModalForm
      title="新增用户"
      trigger={
        <Button type="primary" icon={<PlusOutlined />}>
          新增
        </Button>
      }
      formRef={formRef}
      autoFocusFirstInput={false}
      modalProps={{
        destroyOnHidden: true,
        onCancel: () => {
          formRef.current?.resetFields();
        },
      }}
      submitTimeout={2000}
      onFinish={handleSubmit}
      width={600}
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
        label="密码"
        placeholder="请输入密码（可选，留空将生成随机密码）"
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
        initialValue="normal"
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
        initialValue="free"
        rules={[{ required: true, message: '请选择等级' }]}
      />

      <ProFormDigit
        name="credits"
        label="初始积分"
        min={0}
        max={999999}
        initialValue={0}
        fieldProps={{
          precision: 0,
        }}
      />

      <ProFormDigit
        name="balance"
        label="初始余额"
        min={0}
        max={999999}
        initialValue={0}
        fieldProps={{
          precision: 2,
          addonBefore: '$',
        }}
      />

      <ProFormText
        name="avatarUrl"
        label="头像URL"
        placeholder="请输入头像URL（可选）"
      />
    </ModalForm>
  );
};

export default CreateForm;