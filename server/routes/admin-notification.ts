import { RequestHandler } from "express";
import { AdminNotificationRequest, AdminNotificationRecord } from "@shared/types";
import { emailService } from "../services/emailService";

export const handleAdminNotification: RequestHandler = async (req, res) => {
  try {
    const notificationData: AdminNotificationRequest = req.body;
    
    console.log('📧 Processing admin notification request:', {
      type: notificationData.type,
      worker: notificationData.existingWorker.name,
      targetAdmin: notificationData.adminEmail
    });

    // Create email content
    const emailSubject = "Tentative d'enregistrement d'un ouvrier déjà actif";
    
    const emailContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #fee2e2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h2 style="color: #dc2626; margin: 0 0 15px 0;">⚠️ Tentative d'enregistrement d'un ouvrier déjà actif</h2>
        
        <p>Une tentative d'enregistrement a été effectuée pour l'ouvrier <strong>${notificationData.existingWorker.name}</strong> (CIN: <strong>${notificationData.existingWorker.cin}</strong>) le <strong>${new Date(notificationData.attemptDetails.attemptDate).toLocaleDateString('fr-FR')}</strong>, dans l'exploitation <strong>${notificationData.attemptDetails.attemptingFarm}</strong>, alors qu'il est toujours actif dans votre exploitation <strong>${notificationData.existingWorker.currentFarm}</strong>.</p>
      </div>

      <div style="background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="color: #1d4ed8; margin: 0 0 10px 0;">📋 Détails de la tentative</h3>
        <ul style="margin: 0; padding-left: 20px;">
          <li><strong>Exploitation tentante:</strong> ${notificationData.attemptDetails.attemptingFarm}</li>
          <li><strong>Date de la tentative:</strong> ${new Date(notificationData.attemptDetails.attemptDate).toLocaleDateString('fr-FR')} à ${new Date(notificationData.attemptDetails.attemptDate).toLocaleTimeString('fr-FR')}</li>
          <li><strong>Date d'entrée proposée:</strong> ${new Date(notificationData.attemptDetails.attemptedEntry).toLocaleDateString('fr-FR')}</li>
          ${notificationData.attemptDetails.attemptedRoom ? `<li><strong>Chambre proposée:</strong> ${notificationData.attemptDetails.attemptedRoom}</li>` : ''}
        </ul>
      </div>

      <div style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="color: #d97706; margin: 0 0 10px 0;">🔄 Actions recommandées</h3>
        <p>Veuillez vérifier le statut de l'ouvrier et prendre les mesures appropriées :</p>
        <ol style="margin: 10px 0; padding-left: 20px;">
          <li>Si l'ouvrier a quitté votre exploitation, marquez-le comme "inactif" dans le système</li>
          <li>Si l'ouvrier est toujours actif chez vous, contactez l'exploitation ${notificationData.attemptDetails.attemptingFarm}</li>
          <li>Si c'est un transfert officiel, utilisez la procédure de transfert appropriée</li>
        </ol>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${notificationData.existingWorker.profileLink}" 
           style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          🔗 Voir le profil de l'ouvrier
        </a>
      </div>

      <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; font-size: 12px; color: #6b7280;">
        <p style="margin: 0;">Cette notification a été générée automatiquement par le système de gestion des ouvriers.</p>
        <p style="margin: 5px 0 0 0;">Date d'envoi: ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
      </div>
    </div>
    `;

    // Send actual email using email service
    const emailResult = await emailService.sendAdminNotification(notificationData);

    if (!emailResult.success) {
      console.error('❌ Failed to send admin notification email:', emailResult.error);
      // Continue with logging but mark as failed
    } else {
      console.log('✅ Admin notification email sent successfully:', emailResult.messageId);
    }

    // Store notification in database for audit trail
    const notificationRecord: AdminNotificationRecord = {
      id: `notification_${Date.now()}`,
      type: notificationData.type,
      workerCin: notificationData.existingWorker.cin,
      workerName: notificationData.existingWorker.name,
      currentFarm: notificationData.existingWorker.currentFarm,
      attemptingFarm: notificationData.attemptDetails.attemptingFarm,
      sentTo: notificationData.adminEmail,
      sentAt: new Date().toISOString(),
      status: emailResult.success ? 'sent' : 'failed',
      emailContent: emailContent
    };

    // Here you would save to your database
    console.log('💾 Notification record for audit:', notificationRecord);

    res.json({
      success: emailResult.success,
      message: emailResult.success ? 'Admin notification sent successfully' : 'Notification logged but email failed to send',
      notificationId: notificationRecord.id,
      emailSent: emailResult.success,
      emailError: emailResult.error
    });

  } catch (error) {
    console.error('❌ Failed to send admin notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send admin notification',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};
