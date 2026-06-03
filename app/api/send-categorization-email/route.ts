import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import fs from 'fs/promises';
import path from 'path';
import { Transaction, Account } from '@/lib/types';
import { apiLogger as logger } from '@/lib/logger';

// Create Gmail transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const DATA_DIR = process.env.DATA_DIR || './data';

export async function POST(request: NextRequest) {
  try {
    const { transactionIds, recipientEmail } = await request.json();
    
    if (!transactionIds || !Array.isArray(transactionIds) || transactionIds.length === 0) {
      return NextResponse.json({ error: 'Transaction IDs are required' }, { status: 400 });
    }
    
    if (!recipientEmail) {
      return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 });
    }

    // Load all transactions to get details
    let accountsData;
    try {
      accountsData = JSON.parse(
        await fs.readFile(path.join(DATA_DIR, 'accounts.json'), 'utf-8')
      );
    } catch (error) {
      logger.error('Error loading accounts.json:', error);
      return NextResponse.json(
        { error: 'Failed to load accounts data', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
    
    const accounts: Account[] = Array.isArray(accountsData?.accounts) ? accountsData.accounts : [];
    
    if (accounts.length === 0) {
      return NextResponse.json(
        { error: 'No accounts found in system' },
        { status: 500 }
      );
    }
    
    // Load transactions from all account files
    let allTransactions: Transaction[] = [];
    for (const account of accounts) {
      const transactionFile = path.join(DATA_DIR, 'transactions', `account-${account.id}.json`);
      try {
        const accountTransactions = JSON.parse(await fs.readFile(transactionFile, 'utf-8'));
        // Transaction files are stored as plain arrays
        if (Array.isArray(accountTransactions)) {
          allTransactions = allTransactions.concat(accountTransactions);
        }
      } catch (error) {
        // File might not exist yet
        logger.info(`No transactions file for account ${account.id}`);
      }
    }

    // Filter to only requested transactions
    const selectedTransactions = allTransactions.filter(t => transactionIds.includes(t.id));
    
    if (selectedTransactions.length === 0) {
      return NextResponse.json({ error: 'No transactions found' }, { status: 404 });
    }

    // Build the categorization link using the request's host (works with IP, hostname, or localhost)
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const baseUrl = `${protocol}://${host}`;
    const transactionIdsParam = transactionIds.join(',');
    const categorizationUrl = `${baseUrl}/transactions?selectedIds=${transactionIdsParam}&category=uncategorized`;

    // Calculate total amount
    const totalAmount = selectedTransactions.reduce((sum, t) => sum + t.amount, 0);

    // Build transaction list for email
    const transactionListHtml = selectedTransactions
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(t => {
        const account = accounts.find(a => a.id === t.accountId);
        return `
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 12px 8px;">${new Date(t.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
            <td style="padding: 12px 8px;">${t.description || '-'}</td>
            <td style="padding: 12px 8px;">${account?.name || 'Unknown'}</td>
            <td style="padding: 12px 8px; text-align: right; font-weight: 600; color: ${t.type === 'expense' ? '#dc2626' : '#16a34a'};">
              $${t.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </td>
          </tr>
        `;
      })
      .join('');

    // Send email using Nodemailer (Gmail)
    const info = await transporter.sendMail({
      from: `"Finance App" <${process.env.GMAIL_USER}>`,
      to: recipientEmail,
      subject: `Please categorize ${selectedTransactions.length} transaction${selectedTransactions.length !== 1 ? 's' : ''}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">💰 Transactions Need Categorization</h1>
            </div>
            
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
              <p style="font-size: 16px; margin-top: 0;">Hi! 👋</p>
              
              <p style="font-size: 16px;">
                There ${selectedTransactions.length === 1 ? 'is' : 'are'} <strong>${selectedTransactions.length} uncategorized transaction${selectedTransactions.length !== 1 ? 's' : ''}</strong> 
                totaling <strong style="color: ${totalAmount >= 0 ? '#16a34a' : '#dc2626'};">$${Math.abs(totalAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong> 
                that need${selectedTransactions.length === 1 ? 's' : ''} your attention.
              </p>

              <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <h3 style="margin-top: 0; color: #374151;">Transaction Details:</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <thead>
                    <tr style="background: #f3f4f6; border-bottom: 2px solid #e5e7eb;">
                      <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #6b7280;">Date</th>
                      <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #6b7280;">Description</th>
                      <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #6b7280;">Account</th>
                      <th style="padding: 12px 8px; text-align: right; font-weight: 600; color: #6b7280;">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${transactionListHtml}
                  </tbody>
                </table>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${categorizationUrl}" 
                   style="display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">
                  Categorize Transactions Now
                </a>
              </div>

              <p style="font-size: 14px; color: #6b7280; margin-bottom: 0;">
                Click the button above to open the finance app and categorize these transactions. 
                The transactions will be automatically selected for you.
              </p>
            </div>

            <div style="text-align: center; margin-top: 20px; padding: 20px; color: #9ca3af; font-size: 12px;">
              <p style="margin: 0;">Personal Finance App</p>
              <p style="margin: 5px 0 0 0;">Sent on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            </div>
          </body>
        </html>
      `,
    });

    return NextResponse.json({ 
      success: true, 
      message: `Email sent successfully to ${recipientEmail}`,
      emailId: info.messageId,
      transactionCount: selectedTransactions.length
    });

  } catch (error) {
    logger.error('Error sending categorization email:', error);
    return NextResponse.json({ 
      error: 'Failed to send email', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
