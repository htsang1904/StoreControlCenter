import { reactive, ref } from 'vue'

export const CHAT_STEPS = {
  SELECT_TICKET_TYPE: 'select_ticket_type',
  SELECT_STORE: 'select_store',
  SELECT_DEPARTMENT: 'select_department',
  INPUT_CONTENT: 'input_content',
  CONFIRM: 'confirm',
  CREATING: 'creating',
  DONE: 'done'
}

export function useTicketCreateChat() {
  const currentStep = ref(CHAT_STEPS.SELECT_TICKET_TYPE)

  
  const formData = reactive({
    type: '',
    type_name: '',
    store_id: '',
    store_name: '',
    responsible_department_id: '',
    department_name: '',
    title: '',
    description: '',
    attachments_media: []
  })
  
  const messages = ref([])

  function addMessage(role, type, content, extra = {}) {
    messages.value.push({
      id: Date.now() + Math.random().toString(36).substring(2),
      role, // 'bot' | 'user'
      type, // 'text' | 'action_store' | 'action_department' | 'action_content' | 'action_confirm' | 'attachment_preview'
      content,
      ...extra
    })
  }

  function resetState() {
    currentStep.value = CHAT_STEPS.SELECT_STORE
    formData.type = ''
    formData.type_name = ''
    formData.store_id = ''
    formData.store_name = ''
    formData.responsible_department_id = ''
    formData.department_name = ''
    formData.title = ''
    formData.description = ''
    formData.attachments_media = []
    messages.value = []
    
    addMessage('bot', 'text', 'Xin chào! Bạn đang muốn tạo một yêu cầu hỗ trợ mới.')
    addMessage('bot', 'action_store', 'Vui lòng chọn cửa hàng cần hỗ trợ.')
  }

  function selectTicketType(typeValue, typeLabel) {
    formData.type = typeValue
    formData.type_name = typeLabel
    addMessage('user', 'text', `Phân loại: **${typeLabel}**`)
    
    currentStep.value = CHAT_STEPS.SELECT_STORE
    addMessage('bot', 'text', 'Đã ghi nhận phân loại.')
    addMessage('bot', 'action_store', 'Vui lòng chọn cửa hàng cần hỗ trợ.')
  }

  function selectStore(storeId, storeName) {
    formData.store_id = storeId
    formData.store_name = storeName
    addMessage('user', 'text', `Cửa hàng: **${storeName}**`)
    
    currentStep.value = CHAT_STEPS.SELECT_DEPARTMENT
    addMessage('bot', 'text', 'Tuyệt vời.')
    addMessage('bot', 'action_department', 'Bạn muốn gửi yêu cầu này đến bộ phận nào?')
  }

  function selectDepartment(deptId, deptName) {
    formData.responsible_department_id = deptId
    formData.department_name = deptName
    addMessage('user', 'text', `Bộ phận: **${deptName}**`)
    
    currentStep.value = CHAT_STEPS.INPUT_CONTENT
    addMessage('bot', 'action_content', 'Vui lòng nhập nội dung chi tiết và đính kèm hình ảnh (nếu có).')
  }

  function submitContent(description, attachments) {
    formData.title = formData.store_name || 'Yêu cầu hỗ trợ'
    formData.description = description
    formData.attachments_media = attachments
    
    addMessage('user', 'text', `**Nội dung:**\n${description}`)
    if (attachments && attachments.length) {
      addMessage('user', 'attachment_preview', 'Đã đính kèm ảnh', { attachments })
    }

    currentStep.value = CHAT_STEPS.CONFIRM
    addMessage('bot', 'action_confirm', 'Tất cả thông tin đã đầy đủ. Bạn có muốn tạo ticket ngay bây giờ không?')
  }

  return {
    currentStep,
    formData,
    messages,
    resetState,
    addMessage,
    selectTicketType,
    selectStore,
    selectDepartment,
    submitContent
  }
}
