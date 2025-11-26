import { useState } from 'react';
import { useRoute } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { ArrowLeft, Clock, Brain, User, Stethoscope, ChevronDown, ChevronUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import ChatMessage from '@/components/ChatMessage';
import DetailedConfidenceIndicator from '@/components/DetailedConfidenceIndicator';
import { cn } from '@/lib/utils';

interface MessageDetailResponse {
  conversation: {
    id: string;
    patientId: string;
    title: string;
    status: 'active' | 'pending_review' | 'reviewed' | 'closed';
    confidenceScore: number | null;
    avgDecisionAlignment?: number | null;
    avgClinicalAccuracy?: number | null;
    avgSafetyAssessment?: number | null;
    avgContextUnderstanding?: number | null;
    avgResponseAppropriateness?: number | null;
    needsNurseReview: boolean;
    needsDoctorReview: boolean;
    nurseReviewedBy: string | null;
    doctorReviewedBy: string | null;
    escalatedToDoctor: boolean;
    escalationReason: string | null;
    createdAt: string;
    updatedAt: string;
  };
  messages: Array<{
    id: string;
    conversationId: string;
    sender: 'patient' | 'ai' | 'nurse' | 'doctor';
    content: string;
    confidenceScore: number | null;
    nurseAnnotation: string | null;
    doctorAnnotation: string | null;
    timestamp: string;
  }>;
  patient: {
    id: string;
    name: string;
    role: string;
  } | null;
  review: {
    id: string;
    status: string;
    feedback: string | null;
    escalationReason: string | null;
  } | null;
}

export default function MessageDetailView() {
  const [, params] = useRoute('/messages/:id');
  const messageId = params?.id;
  const [showConfidenceBreakdown, setShowConfidenceBreakdown] = useState(false);
  
  const queryClient = useQueryClient();
  
  // Fetch message detail data from API
  const { data: messageDetail, isLoading, error } = useQuery<MessageDetailResponse>({
    queryKey: ['/api/messages', messageId, 'detail'],
    enabled: !!messageId,
    staleTime: 30000, // 30 seconds
  });

  // Mutations for actions
  const startReviewMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/medical-reviews', {
        conversationId: messageId,
        reviewerId: 'nurse-1', // In real app, get from auth context
        reviewerRole: 'nurse',
        status: 'pending'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages', messageId, 'detail'] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      alert('Review started successfully');
    }
  });

  const escalateToDocorMutation = useMutation({
    mutationFn: async (escalationReason: string) => {
      return apiRequest('POST', '/api/medical-reviews', {
        conversationId: messageId,
        reviewerId: 'nurse-1', // In real app, get from auth context
        reviewerRole: 'nurse',
        status: 'escalated_to_doctor',
        escalationReason
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages', messageId, 'detail'] });
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      alert('Case escalated to doctor successfully');
    }
  });

  if (isLoading) {
    return <div className="container mx-auto py-6" data-testid="message-detail-loading">Loading...</div>;
  }

  if (error || !messageDetail) {
    return <div className="container mx-auto py-6" data-testid="message-detail-error">Error loading message details</div>;
  }

  const { conversation, messages, patient, review } = messageDetail;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_review':
        return <Badge variant="outline" className="bg-chart-2/10 text-chart-2 border-chart-2/20">Pending Review</Badge>;
      case 'reviewed':
        return <Badge variant="outline" className="bg-success/10 text-success border-success/20">Reviewed</Badge>;
      case 'escalated':
        return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Escalated</Badge>;
      default:
        return <Badge variant="outline">Active</Badge>;
    }
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 90) return <Badge variant="outline" className="bg-success/10 text-success border-success/20">High ({score}%)</Badge>;
    if (score >= 70) return <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Medium ({score}%)</Badge>;
    return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Low ({score}%)</Badge>;
  };

  return (
    <div className="container mx-auto py-6" data-testid="message-detail-view">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold" data-testid="page-title">Message Detail</h1>
          <p className="text-muted-foreground">Conversation ID: {conversation.id}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Message Content */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Conversation Messages</span>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{new Date(conversation.createdAt).toLocaleString()}</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]" data-testid="messages-scroll">
                <div className="space-y-4">
                  {messages.map((message: any) => (
                    <div key={message.id} className="space-y-2">
                      <ChatMessage
                        id={message.id}
                        sender={message.sender}
                        content={message.content}
                        timestamp={message.timestamp}
                        confidenceScore={message.confidenceScore}
                        isNurseReviewed={message.reviewed}
                        nurseAnnotation={message.annotation}
                        viewerRole="nurse"
                      />
                      {message.nurseAnnotation && (
                        <Card className="ml-12 bg-muted/50 border-warning/20">
                          <CardContent className="pt-4">
                            <div className="flex items-start gap-2">
                              <Brain className="h-4 w-4 text-warning mt-0.5" />
                              <div>
                                <p className="text-sm font-medium text-warning">AI Annotation</p>
                                <p className="text-sm text-muted-foreground">{message.nurseAnnotation}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar with Metadata */}
        <div className="space-y-6">
          {/* Patient Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Patient Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium">Name</p>
                <p className="text-sm text-muted-foreground" data-testid="patient-name">{patient?.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Session Start</p>
                <p className="text-sm text-muted-foreground" data-testid="session-time">{new Date(conversation.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Duration</p>
                <p className="text-sm text-muted-foreground">{((new Date().getTime() - new Date(conversation.createdAt).getTime()) / (1000 * 60)).toFixed(0)} minutes</p>
              </div>
            </CardContent>
          </Card>

          {/* Review Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5" />
                Review Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                {getStatusBadge(conversation.status)}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Nurse Review</span>
                  {conversation.needsNurseReview ? (
                    <Badge variant="outline" className="bg-chart-2/10 text-chart-2 border-chart-2/20">Required</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-muted text-muted-foreground">Complete</Badge>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Doctor Review</span>
                  {conversation.needsDoctorReview ? (
                    <Badge variant="outline" className="bg-medical-blue/10 text-medical-blue border-medical-blue/20">Required</Badge>
                  ) : conversation.escalatedToDoctor ? (
                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Escalated</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-muted text-muted-foreground">Not Required</Badge>
                  )}
                </div>
              </div>

              {(conversation.nurseReviewedBy || conversation.doctorReviewedBy) && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium">Reviewed By</p>
                    <p className="text-sm text-muted-foreground">
                      {conversation.nurseReviewedBy ? 'Nurse' : 'Doctor'} Review
                    </p>
                  </div>
                </>
              )}

              {conversation.escalationReason && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium">Escalation Reason</p>
                    <p className="text-sm text-muted-foreground">{conversation.escalationReason}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* AI Confidence Analysis */}
          {conversation.confidenceScore !== null && conversation.confidenceScore !== undefined && (
            <Card>
              <CardContent className="pt-4">
                <Collapsible open={showConfidenceBreakdown} onOpenChange={setShowConfidenceBreakdown}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="outline"
                      size="lg"
                      className={cn(
                        "w-full justify-between hover-elevate",
                        conversation.confidenceScore >= 90 
                          ? "bg-success/10 text-success border-success/20" 
                          : "bg-destructive/10 text-destructive border-destructive/20"
                      )}
                      data-testid="button-toggle-confidence"
                    >
                      <div className="flex items-center gap-2">
                        {conversation.confidenceScore >= 90 ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : (
                          <AlertTriangle className="h-5 w-5" />
                        )}
                        <span className="font-bold">
                          {conversation.confidenceScore >= 90 ? "Pass" : "Fail"} ({conversation.confidenceScore}%)
                        </span>
                      </div>
                      {showConfidenceBreakdown ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="mt-4">
                    <DetailedConfidenceIndicator
                      overallScore={conversation.confidenceScore}
                      decisionAlignment={conversation.avgDecisionAlignment}
                      clinicalAccuracy={conversation.avgClinicalAccuracy}
                      safetyAssessment={conversation.avgSafetyAssessment}
                      contextUnderstanding={conversation.avgContextUnderstanding}
                      responseAppropriateness={conversation.avgResponseAppropriateness}
                      showOverall={false}
                      showDetails={true}
                      size="sm"
                      compact={true}
                    />
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                className="w-full justify-start" 
                variant="outline"
                data-testid="button-start-review"
                onClick={() => startReviewMutation.mutate()}
                disabled={startReviewMutation.isPending}
              >
                <Stethoscope className="h-4 w-4 mr-2" />
                Start Review
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                data-testid="button-escalate"
                onClick={() => escalateToDocorMutation.mutate('Requires medical professional assessment')}
                disabled={escalateToDocorMutation.isPending}
              >
                <ArrowLeft className="h-4 w-4 mr-2 rotate-180" />
                Escalate to Doctor
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}