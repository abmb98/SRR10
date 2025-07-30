import nodemailer from 'nodemailer';
import { AdminNotificationRequest } from '@shared/types';

// Email service configuration
interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private config: EmailConfig | null = null;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    try {
      // Get email configuration from environment variables
      const emailConfig: EmailConfig = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || ''
        },
        from: process.env.SMTP_FROM || process.env.SMTP_USER || ''
      };

      // Check if required environment variables are set
      if (!emailConfig.auth.user || !emailConfig.auth.pass) {
        console.warn('⚠️ Email service not configured - missing SMTP credentials');
        return;
      }

      this.config = emailConfig;
      this.transporter = nodemailer.createTransporter({
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.secure,
        auth: emailConfig.auth,
        tls: {
          // Do not fail on invalid certificates
          rejectUnauthorized: false
        }
      });

      console.log('✅ Email service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize email service:', error);
    }
  }

  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) {
      console.log('❌ Email transporter not initialized');
      return false;
    }

    try {
      await this.transporter.verify();
      console.log('✅ Email server connection verified');
      return true;
    } catch (error) {
      console.error('❌ Email server connection failed:', error);
      return false;
    }
  }

  async sendAdminNotification(notificationData: AdminNotificationRequest): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.transporter || !this.config) {
      return {
        success: false,
        error: 'Email service not configured'
      };
    }

    try {
      const emailSubject = "🚨 Tentative d'enregistrement d'un ouvrier déjà actif";
      
      const emailContent = this.generateEmailHTML(notificationData);

      const mailOptions = {
        from: `"Système de Gestion des Ouvriers" <${this.config.from}>`,
        to: notificationData.adminEmail,
        subject: emailSubject,
        html: emailContent,
        text: this.generateEmailText(notificationData) // Fallback plain text version
      };

      console.log('📧 Sending admin notification email to:', notificationData.adminEmail);

      const result = await this.transporter.sendMail(mailOptions);
      
      console.log('✅ Admin notification email sent successfully:', result.messageId);
      
      return {
        success: true,
        messageId: result.messageId
      };

    } catch (error) {
      console.error('❌ Failed to send admin notification email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private generateEmailHTML(notificationData: AdminNotificationRequest): string {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">🚨 Alerte Système</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Tentative d'enregistrement d'un ouvrier déjà actif</p>
      </div>

      <!-- Main Content -->
      <div style="padding: 20px;">
        <!-- Alert Box -->
        <div style="background-color: #fee2e2; border: 2px solid #fecaca; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h2 style="color: #dc2626; margin: 0 0 15px 0; font-size: 18px;">⚠️ Détection de doublon</h2>
          
          <p style="margin: 0 0 15px 0; line-height: 1.6;">
            Une tentative d'enregistrement a été effectuée pour l'ouvrier <strong>${notificationData.existingWorker.name}</strong> 
            (CIN: <strong>${notificationData.existingWorker.cin}</strong>) le <strong>${new Date(notificationData.attemptDetails.attemptDate).toLocaleDateString('fr-FR')}</strong> 
            à <strong>${new Date(notificationData.attemptDetails.attemptDate).toLocaleTimeString('fr-FR')}</strong>, 
            dans l'exploitation <strong style="color: #dc2626;">${notificationData.attemptDetails.attemptingFarm}</strong>, 
            alors qu'il est toujours actif dans votre exploitation <strong style="color: #059669;">${notificationData.existingWorker.currentFarm}</strong>.
          </p>
        </div>

        <!-- Details Section -->
        <div style="background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="color: #1d4ed8; margin: 0 0 15px 0; font-size: 16px;">📋 Détails de la tentative</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">Ouvrier concerné:</td>
              <td style="padding: 8px 0; color: #111827;">${notificationData.existingWorker.name}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">CIN:</td>
              <td style="padding: 8px 0; color: #111827;">${notificationData.existingWorker.cin}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">Exploitation actuelle:</td>
              <td style="padding: 8px 0; color: #059669; font-weight: bold;">${notificationData.existingWorker.currentFarm}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">Exploitation tentante:</td>
              <td style="padding: 8px 0; color: #dc2626; font-weight: bold;">${notificationData.attemptDetails.attemptingFarm}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">Date de la tentative:</td>
              <td style="padding: 8px 0; color: #111827;">${new Date(notificationData.attemptDetails.attemptDate).toLocaleDateString('fr-FR')} à ${new Date(notificationData.attemptDetails.attemptDate).toLocaleTimeString('fr-FR')}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">Date d'entrée proposée:</td>
              <td style="padding: 8px 0; color: #111827;">${new Date(notificationData.attemptDetails.attemptedEntry).toLocaleDateString('fr-FR')}</td>
            </tr>
            ${notificationData.attemptDetails.attemptedRoom ? `
            <tr>
              <td style="padding: 8px 0; font-weight: bold; color: #374151;">Chambre proposée:</td>
              <td style="padding: 8px 0; color: #111827;">${notificationData.attemptDetails.attemptedRoom}</td>
            </tr>
            ` : ''}
          </table>
        </div>

        <!-- Actions Required -->
        <div style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="color: #d97706; margin: 0 0 15px 0; font-size: 16px;">🔄 Actions requises</h3>
          <p style="margin: 0 0 15px 0; color: #92400e; line-height: 1.6;">
            Veuillez vérifier le statut de l'ouvrier et prendre les mesures appropriées :
          </p>
          <ol style="margin: 0; padding-left: 20px; color: #92400e; line-height: 1.8;">
            <li><strong>Si l'ouvrier a quitté votre exploitation :</strong> Marquez-le comme "inactif" dans le système avec sa date de sortie</li>
            <li><strong>Si l'ouvrier est toujours actif chez vous :</strong> Contactez immédiatement l'exploitation ${notificationData.attemptDetails.attemptingFarm}</li>
            <li><strong>Si c'est un transfert officiel :</strong> Utilisez la procédure de transfert appropriée dans le système</li>
            <li><strong>En cas de doute :</strong> Contactez l'administrateur système</li>
          </ol>
        </div>

        <!-- Action Button -->
        <div style="text-align: center; margin: 30px 0;">
          <a href="${notificationData.existingWorker.profileLink}" 
             style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
            🔗 Voir le profil de l'ouvrier
          </a>
        </div>

        <!-- Important Notice -->
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
          <p style="margin: 0; color: #991b1b; font-size: 14px; text-align: center;">
            <strong>⚠️ Important:</strong> L'enregistrement de l'ouvrier a été automatiquement bloqué jusqu'à résolution de ce conflit.
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div style="background-color: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
        <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 12px; text-align: center;">
          Cette notification a été générée automatiquement par le système de gestion des ouvriers.
        </p>
        <p style="margin: 0; color: #6b7280; font-size: 12px; text-align: center;">
          Date d'envoi: ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}
        </p>
      </div>
    </div>
    `;
  }

  private generateEmailText(notificationData: AdminNotificationRequest): string {
    return `
🚨 ALERTE SYSTÈME - Tentative d'enregistrement d'un ouvrier déjà actif

⚠️ DÉTECTION DE DOUBLON

Une tentative d'enregistrement a été effectuée pour l'ouvrier ${notificationData.existingWorker.name} (CIN: ${notificationData.existingWorker.cin}) le ${new Date(notificationData.attemptDetails.attemptDate).toLocaleDateString('fr-FR')} à ${new Date(notificationData.attemptDetails.attemptDate).toLocaleTimeString('fr-FR')}, dans l'exploitation ${notificationData.attemptDetails.attemptingFarm}, alors qu'il est toujours actif dans votre exploitation ${notificationData.existingWorker.currentFarm}.

📋 DÉTAILS DE LA TENTATIVE:
- Ouvrier concerné: ${notificationData.existingWorker.name}
- CIN: ${notificationData.existingWorker.cin}
- Exploitation actuelle: ${notificationData.existingWorker.currentFarm}
- Exploitation tentante: ${notificationData.attemptDetails.attemptingFarm}
- Date de la tentative: ${new Date(notificationData.attemptDetails.attemptDate).toLocaleDateString('fr-FR')} à ${new Date(notificationData.attemptDetails.attemptDate).toLocaleTimeString('fr-FR')}
- Date d'entrée proposée: ${new Date(notificationData.attemptDetails.attemptedEntry).toLocaleDateString('fr-FR')}
${notificationData.attemptDetails.attemptedRoom ? `- Chambre proposée: ${notificationData.attemptDetails.attemptedRoom}` : ''}

🔄 ACTIONS REQUISES:
1. Si l'ouvrier a quitté votre exploitation: Marquez-le comme "inactif" dans le système
2. Si l'ouvrier est toujours actif chez vous: Contactez l'exploitation ${notificationData.attemptDetails.attemptingFarm}
3. Si c'est un transfert officiel: Utilisez la procédure de transfert appropriée

🔗 Lien vers le profil: ${notificationData.existingWorker.profileLink}

⚠️ IMPORTANT: L'enregistrement de l'ouvrier a été automatiquement bloqué jusqu'à résolution de ce conflit.

---
Cette notification a été générée automatiquement par le système de gestion des ouvriers.
Date d'envoi: ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}
    `.trim();
  }

  // Test email functionality
  async sendTestEmail(to: string): Promise<{ success: boolean; error?: string }> {
    if (!this.transporter || !this.config) {
      return {
        success: false,
        error: 'Email service not configured'
      };
    }

    try {
      const mailOptions = {
        from: `"Système de Gestion des Ouvriers" <${this.config.from}>`,
        to: to,
        subject: "Test de connexion email - Système de Gestion des Ouvriers",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #059669;">✅ Test de connexion réussi</h2>
            <p>Ce message confirme que le service email fonctionne correctement.</p>
            <p><strong>Date:</strong> ${new Date().toLocaleString('fr-FR')}</p>
            <p style="color: #6b7280; font-size: 12px;">Message automatique du système de gestion des ouvriers.</p>
          </div>
        `,
        text: `Test de connexion email réussi. Date: ${new Date().toLocaleString('fr-FR')}`
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('✅ Test email sent successfully:', result.messageId);
      
      return { success: true };
    } catch (error) {
      console.error('❌ Failed to send test email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
