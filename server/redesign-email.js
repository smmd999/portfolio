const RECIPIENT = 'smmd999a@gmail.com';

function submissionNotification(data) {
  return {
    url: `https://formsubmit.co/ajax/${RECIPIENT}`,
    body: {
      _subject: `New hero redesign request — ${data.work_email}`,
      _template: 'table',
      _captcha: 'false',
      _url: 'https://www.smmd.me/redesign',
      _replyto: data.work_email,
      email: data.work_email,
      'Company URL': data.company_url,
      'X handle or profile': data.x_handle,
      Role: data.role === 'Other' ? `Other: ${data.role_other}` : data.role,
      'Company stage': data.company_stage,
      'Improvement goal': data.improvement_goal,
      'All submissions': 'https://www.smmd.me/redesign/submissions',
    },
  };
}

module.exports = { submissionNotification };
