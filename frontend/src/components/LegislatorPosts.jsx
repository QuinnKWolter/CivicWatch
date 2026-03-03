import { useEffect, useState } from 'react';
import { FaSpinner } from 'react-icons/fa';
import dayjs from 'dayjs';

export default function LegislatorPosts({ legislator, sortFilters, startDate, endDate }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  console.log("LegislatorPosts rendered");
  useEffect(() => {
    console.log("Effect triggered");
    console.log("Legislator:", legislator?.legislator_id);
    console.log("Sort:", sortFilters?.activeSort);
    if (!legislator) {
      setPosts([]);
      return;
    }

    setLoading(true);
    setError(null);

    // Build API URL
    const url = `/api/posts-json?legislator=${legislator.legislator_id}&sort=${sortFilters.activeSort || 'date'}&start_date=${startDate?.format('YYYY-MM-DD')}&end_date=${endDate?.format('YYYY-MM-DD')}`;

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      // .then(data => {
      //     console.log("API response:", data); 

      //     if (Array.isArray(data)) {
      //       setPosts(data);
      //     } else if (Array.isArray(data.posts)) {
      //       setPosts(data.posts);
      //     } else {
      //       setPosts([]);
      //     }
      //   })
      .then(data => {
  console.log("Full API response:", data);

  const postsArray =
    Array.isArray(data) ? data :
    Array.isArray(data.posts) ? data.posts : [];

  console.log("Total posts returned:", postsArray.length);
  console.log("First post object:", postsArray[0]);

  setPosts(postsArray);
})
      .finally(() => setLoading(false));
  }, [legislator, sortFilters, startDate, endDate]);

  if (!legislator) return null;

  return (
    <div className="bg-base-100 rounded-lg p-4 mt-4 shadow-lg">
      <h3 className="text-md font-semibold mb-3">
        Posts for {legislator.name}
      </h3>

      {loading ? (
        <div className="flex items-center space-x-2 text-gray-500">
          <FaSpinner className="animate-spin" /> Loading posts…
        </div>
      ) : error ? (
        <div className="text-sm text-red-500">{error}</div>
      ) : posts.length === 0 ? (
        <div className="text-sm text-gray-500">No posts found for this legislator.</div>
      ) : (
        <div className="overflow-x-auto max-h-[400px]">
          <table className="table table-zebra w-full text-sm">
            <thead>
              <tr>
                <th>Date</th>
                <th>Text</th>
              </tr>
            </thead>
            <tbody>
              {posts.map(post => (
                <tr key={post.id || post.tweet_id}>
                  <td>{dayjs(post.created_at || post.date).format('YYYY-MM-DD')}</td>
                  <td className="max-w-xs">{post.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}