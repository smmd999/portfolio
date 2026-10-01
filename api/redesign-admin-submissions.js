const { isAdminRequest, supabaseRequest } = require('../server/redesign');

module.exports = async function redesignAdminSubmissions(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Allow', 'GET');

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed.' });
  }

  if (!isAdminRequest(req)) {
    return res.status(401).json({ message: 'Passcode required.' });
  }

  const page = Math.max(0, Math.min(10_000, Number.parseInt(req.query.page, 10) || 0));
  const pageSize = 100;
  const params = new URLSearchParams({
    select: 'id,created_at,work_email,company_url,x_handle,role,role_other,company_stage,improvement_goal',
    order: 'created_at.desc',
    limit: String(pageSize + 1),
    offset: String(page * pageSize),
  });

  try {
    const rows = await supabaseRequest(`redesign_submissions?${params}`);
    const hasMore = rows.length > pageSize;
    return res.status(200).json({
      submissions: rows.slice(0, pageSize),
      has_more: hasMore,
      next_page: hasMore ? page + 1 : null,
    });
  } catch (error) {
    console.error('Unable to load redesign submissions:', error.message, error.details || '');
    return res.status(503).json({ message: 'Unable to load submissions right now.' });
  }
};
