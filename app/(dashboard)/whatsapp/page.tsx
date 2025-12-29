'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Sidebar from '../../components/layout/Sidebar'
import TopHeader from '../../components/layout/TopHeader'
import VoiceMessage from '../../components/VoiceMessage'
import VoiceRecorder from '../../components/VoiceRecorder'
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  UserCircleIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  PaperClipIcon,
  PhotoIcon,
  VideoCameraIcon,
  DocumentIcon,
  MapPinIcon,
  XMarkIcon,
  SignalIcon,
  SignalSlashIcon,
} from '@heroicons/react/24/outline'

interface Message {
  id: string
  message_id: string
  from_number: string
  customer_name: string
  message_text: string
  message_type: 'incoming' | 'outgoing'
  media_type?: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact'
  media_url?: string
  created_at: string
  is_read?: boolean
}

interface Conversation {
  phoneNumber: string
  customerName: string
  lastMessage: string
  lastMessageTime: string
  unreadCount: number
  profilePictureUrl?: string
}

interface WhatsAppContact {
  id: string
  phone_number: string
  customer_name: string | null
  profile_picture_url: string | null
  last_picture_fetch: string | null
}

type AttachmentType = 'image' | 'video' | 'document' | 'location' | null

export default function WhatsAppPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [contacts, setContacts] = useState<WhatsAppContact[]>([])
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking')
  const [isSyncing, setIsSyncing] = useState(false)
  const [isRecordingVoice, setIsRecordingVoice] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Attachment state
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false)
  const [attachmentType, setAttachmentType] = useState<AttachmentType>(null)
  const [mediaUrl, setMediaUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [filename, setFilename] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [locationName, setLocationName] = useState('')

  // File picker state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Location state
  const [isGettingLocation, setIsGettingLocation] = useState(false)

  // File input refs
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const documentInputRef = useRef<HTMLInputElement>(null)

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  // Check connection status
  const checkConnectionStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/whatsapp/send')
      const data = await response.json()
      setConnectionStatus(data.connected ? 'connected' : 'disconnected')
    } catch {
      setConnectionStatus('disconnected')
    }
  }, [])

  // Fetch messages and conversations
  const fetchMessages = useCallback(async () => {
    try {
      setError(null)
      // Fetch messages and contacts in parallel
      const [messagesRes, contactsRes] = await Promise.all([
        fetch('/api/whatsapp/messages'),
        fetch('/api/whatsapp/contacts')
      ])

      const messagesData = await messagesRes.json()
      const contactsData = await contactsRes.json()

      setMessages(messagesData.messages || [])
      setContacts(contactsData || [])

      // Merge profile pictures into conversations
      const conversationsWithPictures = (messagesData.conversations || []).map((conv: Conversation) => {
        const contact = (contactsData || []).find(
          (c: WhatsAppContact) => c.phone_number === conv.phoneNumber
        )
        return {
          ...conv,
          profilePictureUrl: contact?.profile_picture_url || null
        }
      })
      setConversations(conversationsWithPictures)
    } catch (err) {
      console.error('Error fetching messages:', err)
      setError('فشل في تحميل الرسائل')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Sync contacts and fetch profile pictures
  const syncContacts = useCallback(async () => {
    try {
      setIsSyncing(true)
      const response = await fetch('/api/whatsapp/sync-contacts', { method: 'POST' })
      const data = await response.json()

      if (data.success) {
        console.log('✅ Contacts synced:', data.results)
        // Refresh messages to get updated profile pictures
        await fetchMessages()
      } else {
        console.error('❌ Sync failed:', data.error)
      }
    } catch (err) {
      console.error('❌ Error syncing contacts:', err)
    } finally {
      setIsSyncing(false)
    }
  }, [fetchMessages])

  // Mark messages as read when conversation is opened
  const markConversationAsRead = useCallback(async (phoneNumber: string) => {
    try {
      await fetch('/api/whatsapp/mark-as-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber })
      })

      // Update local state immediately for better UX
      setConversations(prev => prev.map(conv =>
        conv.phoneNumber === phoneNumber
          ? { ...conv, unreadCount: 0 }
          : conv
      ))
    } catch (error) {
      console.error('Error marking as read:', error)
    }
  }, [])

  // Initial fetch and polling
  useEffect(() => {
    fetchMessages()
    checkConnectionStatus()

    // Poll for new messages every 5 seconds
    const interval = setInterval(fetchMessages, 5000)
    // Check connection status every 30 seconds
    const statusInterval = setInterval(checkConnectionStatus, 30000)

    return () => {
      clearInterval(interval)
      clearInterval(statusInterval)
    }
  }, [fetchMessages, checkConnectionStatus])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, selectedConversation])

  // Filter messages for selected conversation
  const conversationMessages = messages.filter(
    msg => msg.from_number === selectedConversation
  )

  // Filter conversations by search
  const filteredConversations = conversations.filter(conv =>
    conv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.phoneNumber.includes(searchQuery)
  )

  // Reset attachment state
  const resetAttachment = () => {
    setAttachmentType(null)
    setMediaUrl('')
    setCaption('')
    setFilename('')
    setLatitude('')
    setLongitude('')
    setLocationName('')
    setShowAttachmentMenu(false)
    setSelectedFile(null)
    if (filePreview) {
      URL.revokeObjectURL(filePreview)
    }
    setFilePreview(null)
    setIsUploading(false)
    setIsGettingLocation(false)
    // Reset file inputs
    if (imageInputRef.current) imageInputRef.current.value = ''
    if (videoInputRef.current) videoInputRef.current.value = ''
    if (documentInputRef.current) documentInputRef.current.value = ''
  }

  // Handle getting current location from device
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      setError('المتصفح لا يدعم تحديد الموقع')
      return
    }

    setIsGettingLocation(true)
    setShowAttachmentMenu(false)
    setAttachmentType('location')
    setError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toString())
        setLongitude(position.coords.longitude.toString())
        setIsGettingLocation(false)
      },
      (err) => {
        console.error('Geolocation error:', err)
        let errorMessage = 'فشل في تحديد الموقع'
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMessage = 'تم رفض الوصول للموقع. يرجى السماح للمتصفح بالوصول للموقع'
            break
          case err.POSITION_UNAVAILABLE:
            errorMessage = 'معلومات الموقع غير متاحة'
            break
          case err.TIMEOUT:
            errorMessage = 'انتهت مهلة طلب الموقع'
            break
        }
        setError(errorMessage)
        setIsGettingLocation(false)
        resetAttachment()
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    )
  }

  // Handle sending location
  const handleSendLocation = async () => {
    if (!selectedConversation || !latitude || !longitude) return

    setIsSending(true)

    try {
      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedConversation,
          messageType: 'location',
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          locationName: locationName || undefined
        })
      })

      const data = await response.json()

      if (data.success) {
        resetAttachment()
        await fetchMessages()
      } else {
        setError(data.error || 'فشل في إرسال الموقع')
      }
    } catch (err) {
      console.error('Error sending location:', err)
      setError('فشل في إرسال الموقع')
    } finally {
      setIsSending(false)
    }
  }

  // Handle file selection from file picker
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'document') => {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    setAttachmentType(type)
    setFilename(file.name)
    setShowAttachmentMenu(false)

    // Create preview for images and videos
    if (type === 'image' || type === 'video') {
      const previewUrl = URL.createObjectURL(file)
      setFilePreview(previewUrl)
    } else {
      setFilePreview(null)
    }
  }

  // Upload and send media file
  const handleSendMedia = async () => {
    if (!selectedConversation || !selectedFile || !attachmentType) return
    if (attachmentType === 'location') return // Location doesn't use file upload

    setIsUploading(true)
    setIsSending(true)

    try {
      // 1. Upload file to Supabase Storage
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('mediaType', attachmentType)

      const uploadResponse = await fetch('/api/whatsapp/upload-media', {
        method: 'POST',
        body: formData
      })

      const uploadResult = await uploadResponse.json()

      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.error || 'فشل في رفع الملف')
      }

      // 2. Send message via WhatsApp
      const sendResponse = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedConversation,
          messageType: attachmentType,
          mediaUrl: uploadResult.url,
          caption: caption || undefined,
          filename: attachmentType === 'document' ? uploadResult.filename : undefined
        })
      })

      const sendResult = await sendResponse.json()

      if (sendResult.success) {
        resetAttachment()
        setNewMessage('')
        await fetchMessages()
      } else {
        setError(sendResult.error || 'فشل في إرسال الملف')
      }

    } catch (err) {
      console.error('Error sending media:', err)
      setError('فشل في إرسال الملف')
    } finally {
      setIsUploading(false)
      setIsSending(false)
    }
  }

  // Send voice note
  const sendVoiceNote = async (audioBlob: Blob, duration: number) => {
    if (!selectedConversation) return

    setIsSending(true)
    try {
      // 1. Upload audio to Supabase Storage
      const formData = new FormData()
      formData.append('audio', audioBlob, `voice_${Date.now()}.webm`)

      const uploadResponse = await fetch('/api/whatsapp/upload-audio', {
        method: 'POST',
        body: formData
      })

      const uploadResult = await uploadResponse.json()

      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.error || 'فشل في رفع الملف الصوتي')
      }

      // 2. Send audio message via WhatsApp
      const sendResponse = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedConversation,
          messageType: 'audio',
          mediaUrl: uploadResult.url
        })
      })

      const sendResult = await sendResponse.json()

      if (sendResult.success) {
        // Refresh messages
        await fetchMessages()
      } else {
        setError(sendResult.error || 'فشل في إرسال الرسالة الصوتية')
      }

    } catch (err) {
      console.error('Error sending voice note:', err)
      setError('فشل في إرسال الرسالة الصوتية')
    } finally {
      setIsSending(false)
      setIsRecordingVoice(false)
    }
  }

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedConversation) return

    // Check if we have something to send
    const hasTextMessage = newMessage.trim()
    const hasAttachment = attachmentType && (mediaUrl || (attachmentType === 'location' && latitude && longitude))

    if (!hasTextMessage && !hasAttachment) return

    setIsSending(true)

    try {
      let requestBody: any = {
        to: selectedConversation,
      }

      if (attachmentType) {
        requestBody.messageType = attachmentType

        switch (attachmentType) {
          case 'image':
          case 'video':
          case 'document':
            requestBody.mediaUrl = mediaUrl
            requestBody.caption = caption || newMessage
            if (attachmentType === 'document') {
              requestBody.filename = filename
            }
            break
          case 'location':
            requestBody.latitude = parseFloat(latitude)
            requestBody.longitude = parseFloat(longitude)
            requestBody.locationName = locationName
            break
        }
      } else {
        requestBody.messageType = 'text'
        requestBody.message = newMessage
      }

      const response = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (data.success) {
        setNewMessage('')
        resetAttachment()
        fetchMessages()
      } else {
        setError(data.error || 'فشل في إرسال الرسالة')
      }
    } catch (err) {
      console.error('Error sending message:', err)
      setError('فشل في إرسال الرسالة')
    } finally {
      setIsSending(false)
    }
  }

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'اليوم'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'أمس'
    }
    return date.toLocaleDateString('ar-EG')
  }

  // Get profile picture for a contact
  const getContactProfilePicture = (phoneNumber: string) => {
    const contact = conversations.find(c => c.phoneNumber === phoneNumber)
    return contact?.profilePictureUrl || null
  }

  // Render message content based on type
  const renderMessageContent = (msg: Message, isVoiceNote?: boolean) => {
    const mediaType = msg.media_type || 'text'

    switch (mediaType) {
      case 'image':
        return (
          <div>
            {msg.media_url && (
              <img
                src={msg.media_url}
                alt="صورة"
                className="max-w-[250px] max-h-[300px] object-cover rounded-lg mb-2 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(msg.media_url, '_blank')}
              />
            )}
            {msg.message_text && msg.message_text !== '[صورة]' && (
              <p className="text-sm whitespace-pre-wrap">{msg.message_text}</p>
            )}
          </div>
        )

      case 'video':
        return (
          <div>
            {msg.media_url && (
              <video
                src={msg.media_url}
                controls
                className="max-w-[280px] max-h-[350px] rounded-lg mb-2"
              />
            )}
            {msg.message_text && msg.message_text !== '[فيديو]' && (
              <p className="text-sm whitespace-pre-wrap">{msg.message_text}</p>
            )}
          </div>
        )

      case 'audio':
        return (
          <div className="-mx-4 -my-2">
            {msg.media_url && (
              <VoiceMessage
                audioUrl={msg.media_url}
                isOutgoing={msg.message_type === 'outgoing'}
                profilePicture={msg.message_type === 'incoming' ? getContactProfilePicture(msg.from_number) : null}
                senderName={msg.customer_name}
              />
            )}
          </div>
        )

      case 'document':
        return (
          <div className="flex items-center gap-2">
            <DocumentIcon className="h-8 w-8 text-gray-300" />
            <div>
              <p className="text-sm font-medium">{msg.message_text || 'مستند'}</p>
              {msg.media_url && (
                <a
                  href={msg.media_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:underline"
                >
                  تحميل
                </a>
              )}
            </div>
          </div>
        )

      case 'location':
        return (
          <div className="flex items-center gap-2">
            <MapPinIcon className="h-6 w-6 text-red-400" />
            <p className="text-sm">{msg.message_text || 'موقع'}</p>
          </div>
        )

      default:
        return <p className="text-sm whitespace-pre-wrap">{msg.message_text}</p>
    }
  }

  return (
    <div className="h-screen bg-[#2B3544] overflow-hidden">
      {/* Top Header */}
      <TopHeader onMenuClick={toggleSidebar} isMenuOpen={isSidebarOpen} />

      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />

      {/* Main Content Container */}
      <div className="h-full pt-12 overflow-hidden flex flex-col">

        {/* Page Header */}
        <div className="bg-[#374151] border-b border-gray-600 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ChatBubbleLeftRightIcon className="h-6 w-6 text-green-500" />
              <h1 className="text-xl font-bold text-white">محادثات واتساب</h1>
              {/* Connection Status */}
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                connectionStatus === 'connected'
                  ? 'bg-green-500/20 text-green-400'
                  : connectionStatus === 'disconnected'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-yellow-500/20 text-yellow-400'
              }`}>
                {connectionStatus === 'connected' ? (
                  <>
                    <SignalIcon className="h-3 w-3" />
                    <span>متصل</span>
                  </>
                ) : connectionStatus === 'disconnected' ? (
                  <>
                    <SignalSlashIcon className="h-3 w-3" />
                    <span>غير متصل</span>
                  </>
                ) : (
                  <>
                    <ArrowPathIcon className="h-3 w-3 animate-spin" />
                    <span>جاري الفحص</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={syncContacts}
                disabled={isSyncing}
                className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-green-600/30 rounded-md transition-colors disabled:opacity-50"
                title="مزامنة صور العملاء"
              >
                <PhotoIcon className={`h-4 w-4 ${isSyncing ? 'animate-pulse' : ''}`} />
                <span className="text-sm">{isSyncing ? 'جاري المزامنة...' : 'مزامنة الصور'}</span>
              </button>
              <button
                onClick={fetchMessages}
                className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-600/30 rounded-md transition-colors"
              >
                <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span className="text-sm">تحديث</span>
              </button>
            </div>
          </div>
        </div>

        {/* Chat Container */}
        <div className="flex-1 flex overflow-hidden">

          {/* Conversations List */}
          <div className="w-80 bg-[#374151] border-l border-gray-600 flex flex-col">
            {/* Search */}
            <div className="p-3 border-b border-gray-600">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث في المحادثات..."
                  className="w-full pl-4 pr-10 py-2 bg-[#2B3544] border border-gray-600 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* Conversations */}
            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-400">جاري التحميل...</div>
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-4">
                  <ChatBubbleLeftRightIcon className="h-12 w-12 text-gray-500 mb-3" />
                  <p className="text-gray-400 text-sm text-center">
                    لا توجد محادثات بعد
                  </p>
                  <p className="text-gray-500 text-xs text-center mt-1">
                    ستظهر الرسائل هنا عندما يتواصل معك العملاء
                  </p>
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <div
                    key={conv.phoneNumber}
                    onClick={() => {
                      setSelectedConversation(conv.phoneNumber)
                      if (conv.unreadCount > 0) {
                        markConversationAsRead(conv.phoneNumber)
                      }
                    }}
                    className={`p-3 border-b border-gray-600/50 cursor-pointer transition-colors ${
                      selectedConversation === conv.phoneNumber
                        ? 'bg-green-600/20 border-r-2 border-r-green-500'
                        : 'hover:bg-gray-600/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {conv.profilePictureUrl ? (
                        <img
                          src={conv.profilePictureUrl}
                          alt={conv.customerName}
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                          onError={(e) => {
                            // Fallback to icon if image fails to load
                            const target = e.target as HTMLImageElement
                            target.style.display = 'none'
                            target.nextElementSibling?.classList.remove('hidden')
                          }}
                        />
                      ) : null}
                      <div className={`w-10 h-10 rounded-full bg-gray-500 flex items-center justify-center flex-shrink-0 ${conv.profilePictureUrl ? 'hidden' : ''}`}>
                        <UserCircleIcon className="h-6 w-6 text-gray-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-white font-medium text-sm truncate">
                            {conv.customerName}
                          </span>
                          <span className="text-gray-400 text-xs">
                            {formatTime(conv.lastMessageTime)}
                          </span>
                        </div>
                        <p className="text-gray-400 text-xs truncate mt-1">
                          {conv.lastMessage}
                        </p>
                        <p className="text-gray-500 text-xs mt-1 font-mono">
                          +{conv.phoneNumber}
                        </p>
                      </div>
                      {conv.unreadCount > 0 && (
                        <span className="bg-green-500 text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 flex flex-col bg-[#2B3544]">
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <div className="bg-[#374151] px-4 py-3 border-b border-gray-600">
                  {(() => {
                    const selectedContact = conversations.find(c => c.phoneNumber === selectedConversation)
                    return (
                      <div className="flex items-center gap-3">
                        {selectedContact?.profilePictureUrl ? (
                          <img
                            src={selectedContact.profilePictureUrl}
                            alt={selectedContact.customerName}
                            className="w-12 h-12 rounded-full object-cover"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.style.display = 'none'
                              target.nextElementSibling?.classList.remove('hidden')
                            }}
                          />
                        ) : null}
                        <div className={`w-12 h-12 rounded-full bg-gray-500 flex items-center justify-center ${selectedContact?.profilePictureUrl ? 'hidden' : ''}`}>
                          <UserCircleIcon className="h-7 w-7 text-gray-300" />
                        </div>
                        <div>
                          <h3 className="text-white font-medium">
                            {selectedContact?.customerName || selectedConversation}
                          </h3>
                          <p className="text-gray-400 text-sm font-mono">
                            +{selectedConversation}
                          </p>
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-3">
                  {conversationMessages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-400">لا توجد رسائل في هذه المحادثة</p>
                    </div>
                  ) : (
                    <>
                      {conversationMessages.map((msg, index) => {
                        const showDate = index === 0 ||
                          formatDate(msg.created_at) !== formatDate(conversationMessages[index - 1].created_at)

                        return (
                          <div key={msg.id || index}>
                            {showDate && (
                              <div className="flex justify-center my-4">
                                <span className="bg-gray-600/50 text-gray-300 text-xs px-3 py-1 rounded-full">
                                  {formatDate(msg.created_at)}
                                </span>
                              </div>
                            )}
                            <div className={`flex ${msg.message_type === 'outgoing' ? 'justify-start' : 'justify-end'}`}>
                              <div
                                className={`max-w-[70%] rounded-lg px-4 py-2 ${
                                  msg.message_type === 'outgoing'
                                    ? 'bg-green-600 text-white rounded-bl-none'
                                    : 'bg-[#374151] text-white rounded-br-none'
                                }`}
                              >
                                {renderMessageContent(msg)}
                                <div className={`flex items-center gap-1 mt-1 ${
                                  msg.message_type === 'outgoing' ? 'justify-start' : 'justify-end'
                                }`}>
                                  <span className="text-xs opacity-70">
                                    {formatTime(msg.created_at)}
                                  </span>
                                  {msg.message_type === 'outgoing' && (
                                    <CheckCircleIcon className="h-3 w-3 opacity-70" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>

                {/* Attachment Preview */}
                {attachmentType && (
                  <div className="bg-[#374151] px-4 py-3 border-t border-gray-600">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white text-sm font-medium">
                        {attachmentType === 'image' && 'إرسال صورة'}
                        {attachmentType === 'video' && 'إرسال فيديو'}
                        {attachmentType === 'document' && 'إرسال مستند'}
                        {attachmentType === 'location' && 'إرسال موقع'}
                      </span>
                      <button
                        onClick={resetAttachment}
                        className="text-gray-400 hover:text-white"
                        disabled={isUploading}
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>

                    {/* File Preview for Image/Video/Document */}
                    {selectedFile && (attachmentType === 'image' || attachmentType === 'video' || attachmentType === 'document') && (
                      <div className="space-y-3">
                        {/* Image Preview */}
                        {attachmentType === 'image' && filePreview && (
                          <div className="flex justify-center">
                            <img
                              src={filePreview}
                              alt="معاينة الصورة"
                              className="max-h-[200px] max-w-full rounded-lg object-contain"
                            />
                          </div>
                        )}

                        {/* Video Preview */}
                        {attachmentType === 'video' && filePreview && (
                          <div className="flex justify-center">
                            <video
                              src={filePreview}
                              controls
                              className="max-h-[200px] max-w-full rounded-lg"
                            />
                          </div>
                        )}

                        {/* Document Preview */}
                        {attachmentType === 'document' && (
                          <div className="flex items-center gap-3 bg-[#2B3544] rounded-lg p-3">
                            <DocumentIcon className="h-10 w-10 text-yellow-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-medium truncate">{filename}</p>
                              <p className="text-gray-400 text-xs">
                                {selectedFile.size > 1024 * 1024
                                  ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`
                                  : `${(selectedFile.size / 1024).toFixed(2)} KB`}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Caption Input */}
                        <input
                          type="text"
                          value={caption}
                          onChange={(e) => setCaption(e.target.value)}
                          placeholder="تعليق (اختياري)"
                          className="w-full px-3 py-2 bg-[#2B3544] border border-gray-600 rounded-md text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                          disabled={isUploading}
                        />

                        {/* Send Button */}
                        <button
                          type="button"
                          onClick={handleSendMedia}
                          disabled={isUploading || isSending}
                          className={`w-full py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                            isUploading || isSending
                              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                        >
                          {isUploading ? (
                            <>
                              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                              </svg>
                              <span>جاري الرفع...</span>
                            </>
                          ) : (
                            <>
                              <PaperAirplaneIcon className="h-5 w-5 rotate-180" />
                              <span>إرسال</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {/* Location Preview */}
                    {attachmentType === 'location' && (
                      <div className="space-y-3">
                        {isGettingLocation ? (
                          // Loading indicator while getting location
                          <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                            <svg className="animate-spin h-8 w-8 mb-3 text-green-500" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                            </svg>
                            <span className="text-sm">جاري تحديد موقعك...</span>
                          </div>
                        ) : latitude && longitude ? (
                          // Location found - show coordinates and send button
                          <>
                            <div className="bg-[#2B3544] rounded-lg p-3">
                              <div className="flex items-center gap-3 mb-2">
                                <MapPinIcon className="h-8 w-8 text-red-400 flex-shrink-0" />
                                <div className="flex-1">
                                  <p className="text-white text-sm font-medium">تم تحديد موقعك</p>
                                  <p className="text-gray-400 text-xs mt-1">
                                    {parseFloat(latitude).toFixed(6)}, {parseFloat(longitude).toFixed(6)}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <input
                              type="text"
                              value={locationName}
                              onChange={(e) => setLocationName(e.target.value)}
                              placeholder="اسم المكان (اختياري)"
                              className="w-full px-3 py-2 bg-[#2B3544] border border-gray-600 rounded-md text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                            />

                            <button
                              type="button"
                              onClick={handleSendLocation}
                              disabled={isSending}
                              className={`w-full py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                                isSending
                                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                  : 'bg-green-600 hover:bg-green-700 text-white'
                              }`}
                            >
                              {isSending ? (
                                <>
                                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                  </svg>
                                  <span>جاري الإرسال...</span>
                                </>
                              ) : (
                                <>
                                  <PaperAirplaneIcon className="h-5 w-5 rotate-180" />
                                  <span>إرسال الموقع</span>
                                </>
                              )}
                            </button>
                          </>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}

                {/* Message Input */}
                <form onSubmit={handleSendMessage} className="bg-[#374151] px-4 py-3 border-t border-gray-600">
                  {error && (
                    <div className="flex items-center gap-2 text-red-400 text-sm mb-2">
                      <ExclamationCircleIcon className="h-4 w-4" />
                      <span>{error}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    {/* Attachment Button */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-600/50 rounded-full transition-colors"
                      >
                        <PaperClipIcon className="h-5 w-5" />
                      </button>

                      {/* Hidden File Inputs */}
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e, 'image')}
                      />
                      <input
                        ref={videoInputRef}
                        type="file"
                        accept="video/mp4,video/3gpp,video/quicktime,video/webm"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e, 'video')}
                      />
                      <input
                        ref={documentInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e, 'document')}
                      />

                      {/* Attachment Menu */}
                      {showAttachmentMenu && (
                        <div className="absolute bottom-12 right-0 bg-[#2B3544] border border-gray-600 rounded-lg shadow-lg p-2 min-w-[150px]">
                          <button
                            type="button"
                            onClick={() => { imageInputRef.current?.click(); setShowAttachmentMenu(false) }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-gray-300 hover:bg-gray-600/50 rounded-md text-sm"
                          >
                            <PhotoIcon className="h-5 w-5 text-blue-400" />
                            <span>صورة</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => { videoInputRef.current?.click(); setShowAttachmentMenu(false) }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-gray-300 hover:bg-gray-600/50 rounded-md text-sm"
                          >
                            <VideoCameraIcon className="h-5 w-5 text-purple-400" />
                            <span>فيديو</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => { documentInputRef.current?.click(); setShowAttachmentMenu(false) }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-gray-300 hover:bg-gray-600/50 rounded-md text-sm"
                          >
                            <DocumentIcon className="h-5 w-5 text-yellow-400" />
                            <span>مستند</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleGetLocation}
                            className="flex items-center gap-2 w-full px-3 py-2 text-gray-300 hover:bg-gray-600/50 rounded-md text-sm"
                          >
                            <MapPinIcon className="h-5 w-5 text-red-400" />
                            <span>موقع</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Voice Recorder or Text Input */}
                    {isRecordingVoice ? (
                      <VoiceRecorder
                        onSend={sendVoiceNote}
                        onCancel={() => setIsRecordingVoice(false)}
                        isRecording={isRecordingVoice}
                        setIsRecording={setIsRecordingVoice}
                      />
                    ) : (
                      <>
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          placeholder={attachmentType ? "تعليق إضافي (اختياري)..." : "اكتب رسالتك هنا..."}
                          className="flex-1 px-4 py-2 bg-[#2B3544] border border-gray-600 rounded-full text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          disabled={isSending}
                        />

                        {/* Show send button if there's text or attachment, otherwise show mic button */}
                        {(newMessage.trim() || attachmentType) ? (
                          <button
                            type="submit"
                            disabled={isSending}
                            className={`p-3 rounded-full transition-colors ${
                              !isSending
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            }`}
                          >
                            {isSending ? (
                              <ClockIcon className="h-5 w-5 animate-pulse" />
                            ) : (
                              <PaperAirplaneIcon className="h-5 w-5 rotate-180" />
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsRecordingVoice(true)}
                            className="p-3 rounded-full bg-green-600 hover:bg-green-700 text-white transition-colors"
                            title="تسجيل رسالة صوتية"
                          >
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93V7h2v1c0 2.76 2.24 5 5 5s5-2.24 5-5V7h2v1c0 4.08-3.06 7.44-7 7.93V18h3v2H9v-2h3v-2.07z"/>
                            </svg>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </form>
              </>
            ) : (
              /* No Conversation Selected */
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <ChatBubbleLeftRightIcon className="h-24 w-24 text-gray-500 mb-4" />
                <h3 className="text-xl font-medium mb-2">مرحباً بك في محادثات واتساب</h3>
                <p className="text-sm">اختر محادثة من القائمة للبدء</p>
                {connectionStatus === 'disconnected' && (
                  <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg max-w-md">
                    <p className="text-red-400 text-sm text-center">
                      الواتساب غير متصل. تأكد من إعداد WasenderAPI وإضافة الـ API Token.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global Styles */}
      <style jsx global>{`
        .scrollbar-hide {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  )
}
