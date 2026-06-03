import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getInstructionTemplate } from '@/lib/csvInstructionTemplates';
import { apiLogger as logger } from '@/lib/logger';

// Create Gmail transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function POST(request: NextRequest) {
  try {
    const { recipientEmail, includeTransactions, includePositions } = await request.json();
    
    if (!recipientEmail) {
      return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 });
    }

    if (!includeTransactions && !includePositions) {
      return NextResponse.json({ error: 'Must include at least one type (transactions or positions)' }, { status: 400 });
    }

    // Get Fidelity instruction template
    const template = getInstructionTemplate('fidelity');
    const institutionName = template.institution;

    // Build sections HTML
    let sectionsHtml = '';

    if (includeTransactions) {
      const steps = template.transactions.steps
        .map(step => `
          <div style="margin-bottom: 16px;">
            <div style="font-weight: 600; color: #1f2937; margin-bottom: 4px;">${step.text}</div>
            ${step.details ? `<div style="font-size: 14px; color: #6b7280; margin-left: 16px;">${step.details}</div>` : ''}
          </div>
        `)
        .join('');

      const tips = template.transactions.tips
        ? `
          <div style="margin-top: 20px; padding: 16px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
            <div style="font-weight: 600; color: #92400e; margin-bottom: 8px;">💡 Tips:</div>
            ${template.transactions.tips.map(tip => `<div style="font-size: 14px; color: #78350f; margin-bottom: 4px;">• ${tip}</div>`).join('')}
          </div>
        `
        : '';

      sectionsHtml += `
        <div style="margin-bottom: 40px;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 20px; display: flex; align-items: center;">
              📥 Downloading Transaction CSV Files
            </h2>
          </div>
          <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <div style="background: #dbeafe; padding: 12px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #3b82f6;">
              <div style="font-weight: 600; color: #1e40af; margin-bottom: 4px;">📋 Download from BOTH accounts:</div>
              <div style="font-size: 14px; color: #1e3a8a;">• Rollover IRA (Katie)</div>
              <div style="font-size: 14px; color: #1e3a8a;">• Athena Health 401k</div>
            </div>
            ${steps}
            ${tips}
          </div>
        </div>
      `;
    }

    if (includePositions) {
      const steps = template.positions.steps
        .map(step => `
          <div style="margin-bottom: 16px;">
            <div style="font-weight: 600; color: #1f2937; margin-bottom: 4px;">${step.text}</div>
            ${step.details ? `<div style="font-size: 14px; color: #6b7280; margin-left: 16px;">${step.details}</div>` : ''}
          </div>
        `)
        .join('');

      const tips = template.positions.tips
        ? `
          <div style="margin-top: 20px; padding: 16px; background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
            <div style="font-weight: 600; color: #92400e; margin-bottom: 8px;">💡 Tips:</div>
            ${template.positions.tips.map(tip => `<div style="font-size: 14px; color: #78350f; margin-bottom: 4px;">• ${tip}</div>`).join('')}
          </div>
        `
        : '';

      sectionsHtml += `
        <div style="margin-bottom: 40px;">
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0; font-size: 20px; display: flex; align-items: center;">
              📊 Downloading Position CSV Files
            </h2>
          </div>
          <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <div style="background: #d1fae5; padding: 12px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid #10b981;">
              <div style="font-weight: 600; color: #065f46; margin-bottom: 4px;">📋 Download from BOTH accounts:</div>
              <div style="font-size: 14px; color: #047857;">• Rollover IRA (Katie)</div>
              <div style="font-size: 14px; color: #047857;">• Athena Health 401k</div>
            </div>
            ${steps}
            ${tips}
          </div>
        </div>
      `;
    }

    // Send email using Nodemailer (Gmail)
    const info = await transporter.sendMail({
      from: `"Finance App" <${process.env.GMAIL_USER}>`,
      to: recipientEmail,
      subject: `📊 How to Download CSV Files from Fidelity`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto; padding: 20px; background: #f9fafb;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="margin: 0; font-size: 28px;">📁 Fidelity CSV Export Guide</h1>
              <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
                Rollover IRA (Katie) & Athena Health 401k
              </p>
            </div>
            
            <div style="background: #f9fafb; padding: 30px 20px;">
              <p style="font-size: 16px; margin-top: 0;">Hi Katie! 👋</p>
              
              <p style="font-size: 16px; line-height: 1.8;">
                Here's a step-by-step guide for downloading transaction and position CSV files from your Fidelity accounts. 
                You'll need to download files from <strong>both</strong> accounts.
              </p>

              ${sectionsHtml}

              <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin-top: 30px;">
                <h3 style="margin-top: 0; color: #374151;">📌 Important Reminders:</h3>
                <ul style="color: #6b7280; margin: 0; padding-left: 20px;">
                  <li style="margin-bottom: 8px;"><strong>Download from BOTH accounts:</strong> Rollover IRA (Katie) AND Athena Health 401k</li>
                  <li style="margin-bottom: 8px;"><strong>Always select "Year to date"</strong> for transactions (not "Past 30 days")</li>
                  <li style="margin-bottom: 8px;">You should have <strong>4 CSV files total</strong>: 2 transaction files + 2 position files</li>
                  <li style="margin-bottom: 8px;">CSV files go to your Downloads folder</li>
                  <li style="margin-bottom: 8px;">File names usually look like: History_for_Account_*.csv and Portfolio_Positions_*.csv</li>
                </ul>
              </div>

              <div style="text-align: center; margin-top: 30px; padding: 24px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); border-radius: 12px; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);">
                <div style="font-size: 18px; color: white; font-weight: 600; margin-bottom: 12px;">📧 Ready to Send Your Files?</div>
                <div style="font-size: 15px; color: rgba(255,255,255,0.9); margin-bottom: 16px;">
                  Once you've downloaded all 4 CSV files, attach them to an email and send to:
                </div>
                <div style="background: white; padding: 16px; border-radius: 8px; display: inline-block;">
                  <a href="mailto:kris.lippe@gmail.com" style="color: #7c3aed; font-weight: 600; font-size: 16px; text-decoration: none;">
                    kris.lippe@gmail.com
                  </a>
                </div>
                <div style="font-size: 13px; color: rgba(255,255,255,0.8); margin-top: 12px;">
                  💡 Just attach all 4 CSV files to one email - no need to send separate emails!
                </div>
              </div>

              <p style="font-size: 14px; color: #6b7280; margin-top: 30px; margin-bottom: 0; text-align: center;">
                Questions? Just text or call me! 📱
              </p>
            </div>

            <div style="text-align: center; margin-top: 20px; padding: 20px; color: #9ca3af; font-size: 12px;">
              <p style="margin: 0;">Family Finance Tracker</p>
              <p style="margin: 5px 0 0 0;">${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
            </div>
          </body>
        </html>
      `,
    });

    return NextResponse.json({ 
      success: true, 
      message: `Fidelity CSV instructions sent successfully to ${recipientEmail}`,
      emailId: info.messageId,
      institution: institutionName
    });

  } catch (error) {
    logger.error('Error sending CSV instructions email:', error);
    return NextResponse.json({ 
      error: 'Failed to send email', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
